import { Request, Response } from "express";
import AdminWallet from "../models/AdminWallet";
import DareMe from "../models/DareMe";
import User from "../models/User";
import AdminUserTransaction from "../models/AdminUserTransaction";

function calcTime() {
    var d = new Date();
    var utc = d.getTime();
    var nd = new Date(utc + (3600000 * 8));
    return nd;
}

export const getTransactions = async (req: Request, res: Response) => {
    try {
        const { type } = req.params;
        const adminWallet = await AdminWallet.findOne({ admin: "ADMIN" });
        const adminDonuts = adminWallet.wallet; //admin' s donuts
        const users = await User.find({ role: "USER" });
        let userDonuts = 0.0;

        users.forEach((user: any) => {
            userDonuts += user.wallet;
        });

        const daremes = await DareMe.find({});
        let daremeDonuts = 0.0;
        daremes.forEach((dareme: any) => {
            daremeDonuts += dareme.wallet;
        });

        const resUsers = await User.find({}).select({ 'name': 1, 'role': 1 });
        let transactions: any = [];
        if (Number(type) === 0)
            transactions = await AdminUserTransaction.find({ $or: [{ from: 'ADMIN' }, { to: 'ADMIN' }, { description: 1 }] })
                .populate({ path: 'user' }).populate({ path: 'dareme' });
        if (Number(type) === 1)
            transactions = await AdminUserTransaction.find({ $or: [{ from: 'USER' }, { to: 'USER' }, { description: 3 }] })
                .populate({ path: 'user' }).populate({ path: 'dareme' });
                
        return res.status(200).json({
            success: true,
            users: resUsers,
            transactions: transactions,
            adminDonuts: adminDonuts,
            userDonuts: userDonuts,
            daremeDonuts: daremeDonuts
        });
    } catch (err) {
        console.log(err);
    }
};

export const addAdminDonuts = async (req: Request, res: Response) => {
    try {
        const { donuts } = req.body;
        const adminWallets = await AdminWallet.findOne({ admin: 'ADMIN' });
        let wallet = Number(adminWallets.wallet) + Number(donuts);
        await AdminWallet.findOneAndUpdate({ admin: "ADMIN" }, { wallet: wallet });
        const adminTransaction = new AdminUserTransaction({
            description: 1,
            donuts: donuts,
            date: calcTime()
        });
        await adminTransaction.save();
        req.body.io.to("ADMIN").emit("wallet_change", wallet);
        return res.status(200).json({ success: true, donuts: wallet });
    } catch (err) {
        console.log(err);
    }
};

export const transferDonuts = async (req: Request, res: Response) => {
    try {
        const { from, to, amount } = req.body;
        const adminWallets = await AdminWallet.findOne({ admin: 'ADMIN' });
        const fromUser = await User.findById(from);
        const toUser = await User.findById(to);
        if (fromUser.role === "ADMIN" && toUser.role === "ADMIN") return res.status(200).json({ success: false });
        let wallet = 0;
        if (fromUser.role === "ADMIN") {
            wallet = adminWallets.wallet - Number(amount);
            if (wallet < 0) return res.status(200).json({ success: false });
            await AdminWallet.findOneAndUpdate({ admin: "ADMIN" }, { wallet: wallet });
            req.body.io.to("ADMIN").emit("wallet_change", wallet);
        } else {
            wallet = fromUser.wallet - Number(amount);
            if (wallet < 0) return res.status(200).json({ success: false });
            await User.findByIdAndUpdate(from, { wallet: wallet });
            req.body.io.to(fromUser.email).emit("wallet_change", wallet);
        }
        if (toUser.role === "ADMIN") {
            wallet = adminWallets.wallet + Number(amount);
            await AdminWallet.findOneAndUpdate({ admin: "ADMIN" }, { wallet: wallet });
            req.body.io.to("ADMIN").emit("wallet_change", wallet);
        } else {
            wallet = toUser.wallet + Number(amount);
            await User.findByIdAndUpdate(to, { wallet: wallet });
            req.body.io.to(toUser.email).emit("wallet_change", wallet);
        }
        return res.status(200).json({ success: true });
    } catch (err) {
        console.log(err);
    }
}

export const getUserLatest5Transactions = async (req: Request, res: Response) => {
    try {
        const { userId } = req.body;
        const transactions = await AdminUserTransaction.find({ user: userId }).sort({ date: -1 }).limit(5)
            .populate({ path: 'user' }).populate({ path: 'dareme' });
        return res.status(200).json({ success: true, transactions: transactions });
    } catch (err) {
        console.log(err);
    }
}

export const getUserTransactionsByDays = async (req: Request, res: Response) => {
    try {
        const { userId, days } = req.body;
        if (days === 30 || days === 60) {
            const toDate = new Date(calcTime());
            const fromDate = new Date((new Date(calcTime())).getTime() - days * 24 * 3600 * 1000);
            const transactions = await AdminUserTransaction.find({ user: userId })
                .where('date').gte(fromDate).lte(toDate)
                .populate({ path: 'user' }).populate({ path: 'dareme' });
            return res.status(200).json({ success: true, transactions: transactions });
        } else if (days === 0) {
            const transactions = await AdminUserTransaction.find({ user: userId })
                .populate({ path: 'user' }).populate({ path: 'dareme' });
            return res.status(200).json({ success: true, transactions: transactions });
        }
    } catch (err) {
        console.log(err);
    }
}