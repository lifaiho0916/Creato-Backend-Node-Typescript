import { Request, Response } from 'express';
import Stripe from "stripe";
import User from '../models/User';
import Tip from '../models/Tip';
import AdminWallet from '../models/AdminWallet';
import CONSTANT from '../utils/constant';

const stripe = new Stripe(
    CONSTANT.STRIPE_SECRET_KEY,
    { apiVersion: '2020-08-27', typescript: true }
);

export const tipUser = async (req: Request, res: Response) => {
    try {
        const { type, tipper, user, tip, message } = req.body;

        if (type === 1) {
            const walletState = await Promise.all([
                User.findById(tipper),
                User.findById(user),
                AdminWallet.findOne({ admin: "ADMIN" })
            ]);

            const tipperWallet = walletState[0].wallet - tip;
            const receiverWallet = walletState[1].wallet + (tip * 95 / 100);
            const adminWallet = walletState[2].wallet + (tip * 5 / 100);
            const newTip = new Tip({
                tipper: tipper,
                tip: tip,
                message: message,
                user: user
            });

            const updateState = await Promise.all([
                User.findByIdAndUpdate(tipper, { wallet: tipperWallet }, { new: true }),
                User.findByIdAndUpdate(user, { wallet: receiverWallet }, { new: true }),
                AdminWallet.findOneAndUpdate({ admin: "ADMIN" }, { wallet: adminWallet }, { new: true }),
                newTip.save()
            ]);

            req.body.io.to(updateState[1].email).emit("wallet_change", updateState[1].wallet);
            req.body.io.to("ADMIN").emit("wallet_change", updateState[2].wallet);

            const updateUser = updateState[0];
            const payload = {
                id: updateUser._id,
                name: updateUser.name,
                avatar: updateUser.avatar,
                role: updateUser.role,
                email: updateUser.email,
                wallet: updateUser.wallet,
                personalisedUrl: updateUser.personalisedUrl,
                language: updateUser.language,
                category: updateUser.categories,
                new_notification: updateUser.new_notification,
            };

            return res.status(200).json({ success: true, user: payload });
        } else {
            const walletState = await Promise.all([
                User.findById(user),
                AdminWallet.findOne({ admin: "ADMIN" })
            ]);

            const receiverWallet = walletState[0].wallet + (tip * 95 / 100);
            const adminWallet = walletState[1].wallet + (tip * 5 / 100);
            const newTip = new Tip({
                nickname: tipper,
                tip: tip,
                message: message,
                user: user
            });

            const updateState = await Promise.all([
                User.findByIdAndUpdate(user, { wallet: receiverWallet }, { new: true }),
                AdminWallet.findOneAndUpdate({ admin: "ADMIN" }, { wallet: adminWallet }, { new: true }),
                newTip.save()
            ]);

            req.body.io.to(updateState[0].email).emit("wallet_change", updateState[0].wallet);
            req.body.io.to("ADMIN").emit("wallet_change", updateState[1].wallet);

            return res.status(200).json({ success: true });
        }
    } catch (err) {
        console.log(err);
    }
}

export const buyDonutForTip = async (req: Request, res: Response) => {
    try {
        const { token, item, nickname } = req.body;
        let charge = { status: 'requested' };
        let amount = item.donutCount / 10 * (100 - item.discountedPercent) / 100 * 100;
        amount += amount * 0.034 + 30;

        await stripe.charges.create({
            amount: Number(Math.round(amount)),
            currency: 'usd',
            source: token.id,
            description: `Property: ${item.property}, DonutCount: ${item.donutCount}, DiscountedPercent: ${item.discountedPercent}`,
        }).then(result => {
            charge = result;
        }).catch(err => {
            return res.status(200).json({ error: true, msg: err.raw.message })
        })

        if (charge.status === 'succeeded') {
            const adminWallet = await AdminWallet.findOne({ admin: "ADMIN" });
            const adminDonuts = adminWallet.wallet - item.donutCount;
            await AdminWallet.findOneAndUpdate({ admin: "ADMIN" }, { wallet: adminDonuts });
            req.body.io.to("ADMIN").emit("wallet_change", adminDonuts);
            // const transaction = new AdminUserTransaction({
            //     description: 2,
            //     from: "ADMIN",
            //     to: "USER",
            //     user: userId,
            //     donuts: item.donutCount,
            //     date: calcTime()
            // });
            // await transaction.save();
            // const payload = {
            //     id: updatedUser._id,
            //     name: updatedUser.name,
            //     avatar: updatedUser.avatar,
            //     role: updatedUser.role,
            //     email: updatedUser.email,
            //     wallet: updatedUser.wallet,
            //     personalisedUrl: updatedUser.personalisedUrl,
            //     language: updatedUser.language,
            //     category: updatedUser.categories,
            //     new_notification: updatedUser.new_notification,
            // };
            return res.status(200).json({ success: true });
        } else return res.status(200).json({ success: true, result: charge })
    } catch (err) {
        return res.status(200).json({ error: true, msg: 'Payment is failed!' });
    }
}