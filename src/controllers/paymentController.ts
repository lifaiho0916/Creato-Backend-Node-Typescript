import { Request, Response } from 'express';
import Stripe from "stripe";
import CONSTANT from "../utils/constant";
import User from '../models/User';
import AdminWallet from '../models/AdminWallet';
import AdminUserTransaction from '../models/AdminUserTransaction';

const stripe = new Stripe(
    CONSTANT.STRIPE_SECRET_KEY,
    { apiVersion: '2020-08-27', typescript: true }
);

function calcTime() {
    var d = new Date();
    var utc = d.getTime();
    var nd = new Date(utc + (3600000 * 8));
    return nd;
}

export const buyDonuts = async (req: Request, res: Response) => {
    try {
        const { token, item, userId } = req.body;
        const user = await User.findById(userId);
        const amount = Math.round(item.donutCount / 10 * (100 - item.discountedPercent) / 100 * 100);

        const customer = await stripe.customers.create({
            email: user.email,
            name: user.name,
            source: token.id
        });

        const charge = await stripe.charges.create({
            amount: amount,
            currency: 'usd',
            source: token.id,
            description: `Property: ${item.property}, DonutCount: ${item.donutCount}, DiscountedPercent: ${item.discountedPercent} Email: ${user.email} Name: ${user.name}`,
        });

        if (charge.status === 'succeeded') {
            const wallet = user.wallet + item.donutCount;
            const updatedUser = await User.findByIdAndUpdate(user.id, { wallet: wallet }, { new: true });
            req.body.io.to(user.email).emit("wallet_change", wallet);
            const adminWallet = await AdminWallet.findOne({ admin: "ADMIN" });
            const adminDonuts = adminWallet.wallet - item.donutCount;
            await AdminWallet.findOneAndUpdate({ admin: "ADMIN" }, { wallet: adminDonuts });
            req.body.io.to("ADMIN").emit("wallet_change", adminDonuts);
            const transaction = new AdminUserTransaction({
                description: 2,
                from: "ADMIN",
                to: "USER",
                user: userId,
                donuts: item.donutCount,
                date: calcTime()
            });
            await transaction.save();
            const payload = {
                id: updatedUser._id,
                name: updatedUser.name,
                avatar: updatedUser.avatar,
                role: updatedUser.role,
                email: updatedUser.email,
                wallet: updatedUser.wallet,
                personalisedUrl: updatedUser.personalisedUrl,
                language: updatedUser.language,
                category: updatedUser.categories,
                new_notification: updatedUser.new_notification,
            };
            return res.status(200).json({ success: true, user: payload });
        }
    } catch (err) {
        console.log(err);
    }
}