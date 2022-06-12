import { Request, Response } from 'express';
import path from "path";
import multer from "multer";
import fs from "fs";
import Fanwall from "../models/Fanwall";
import DareMe from "../models/DareMe";
import FundMe from "../models/FundMe";
import Option from "../models/Option";
import User from "../models/User";
import AdminWallet from "../models/AdminWallet";
import AdminUserTransaction from '../models/AdminUserTransaction';

function calcTime() {
    var d = new Date();
    var utc = d.getTime();
    var nd = new Date(utc + (3600000 * 8));
    return nd;
}

export const saveFanwall = async (req: Request, res: Response) => {
    try {
        const { fanwallId, userId, daremeId, video, message, posted, embedUrl, cover, sizeType } = req.body;
        if (fanwallId) {
            const fanwall = await Fanwall.findById(fanwallId);
            if (fanwall.video && fanwall.video !== video) {
                const filePath = "public/" + fanwall.video;
                fs.unlink(filePath, (err) => {
                    if (err) throw err;
                });
            }
            if (fanwall.cover && fanwall.cover !== cover) {
                const filePath = "public/" + fanwall.cover;
                fs.unlink(filePath, (err) => {
                    if (err) throw err;
                });
            }
            await Fanwall.findByIdAndUpdate(fanwallId, {
                writer: userId,
                dareme: daremeId,
                video: video,
                sizeType: sizeType,
                cover: cover,
                message: message,
                embedUrl: embedUrl,
                posted: posted,
                date: new Date(calcTime()).getTime()
            });
            if (posted) {
                const dareme = await DareMe.findById(daremeId).populate({ path: 'writer' });
                if (dareme.wallet > 0) {
                    const user = await User.findById(userId);
                    await User.findByIdAndUpdate(userId, { wallet: user.wallet + dareme.wallet / 100 * 90 });
                    req.body.io.to(user.email).emit("wallet_change", user.wallet + dareme.wallet / 100 * 90);
                    const adminWallet = await AdminWallet.findOne({ admin: "ADMIN" });
                    await AdminWallet.findOneAndUpdate({ admin: "ADMIN" }, { wallet: adminWallet.wallet + dareme.wallet / 100 * 10 });
                    req.body.io.to("ADMIN").emit("wallet_change", adminWallet.wallet + dareme.wallet / 100 * 10);
                    const transactionAdmin = new AdminUserTransaction({
                        description: 4,
                        from: "DAREME",
                        to: "ADMIN",
                        dareme: dareme._id,
                        donuts: dareme.wallet / 100 * 10,
                        date: calcTime()
                    });
                    await transactionAdmin.save();
                    const transactionUser = new AdminUserTransaction({
                        description: 4,
                        from: "DAREME",
                        to: "USER",
                        user: userId,
                        dareme: dareme._id,
                        donuts: dareme.wallet / 100 * 90,
                        date: calcTime()
                    });
                    await transactionUser.save();
                    await DareMe.findByIdAndUpdate(daremeId, { wallet: 0 });
                }
            }
            return res.status(200).json({ success: true });
        } else {
            const newFanwall = new Fanwall({
                writer: userId,
                dareme: daremeId,
                video: video,
                sizeType: sizeType,
                cover: cover,
                message: message,
                embedUrl: embedUrl,
                posted: posted,
                date: new Date(calcTime()).getTime()
            });
            await newFanwall.save();
            if (posted) {
                const dareme = await DareMe.findById(daremeId).populate({ path: 'writer' });
                if (dareme.wallet > 0) {
                    const user = await User.findById(userId);
                    await User.findByIdAndUpdate(userId, { wallet: user.wallet + dareme.wallet / 100.0 * 90 });
                    req.body.io.to(user.email).emit("wallet_change", user.wallet + dareme.wallet / 100.0 * 90);
                    const adminWallet = await AdminWallet.findOne({ admin: "ADMIN" });
                    await AdminWallet.findOneAndUpdate({ admin: "ADMIN" }, { wallet: adminWallet.wallet + dareme.wallet / 100.0 * 10 });
                    req.body.io.to("ADMIN").emit("wallet_change", adminWallet.wallet + dareme.wallet / 100.0 * 10);
                    await DareMe.findByIdAndUpdate(daremeId, { wallet: 0 });
                    const transactionAdmin = new AdminUserTransaction({
                        description: 4,
                        from: "DAREME",
                        to: "ADMIN",
                        dareme: dareme._id,
                        donuts: dareme.wallet / 100 * 10,
                        date: calcTime()
                    });
                    await transactionAdmin.save();
                    const transactionUser = new AdminUserTransaction({
                        description: 4,
                        from: "DAREME",
                        to: "USER",
                        user: userId,
                        dareme: dareme._id,
                        donuts: dareme.wallet / 100 * 90,
                        date: calcTime()
                    });
                    await transactionUser.save();
                }
            }
            return res.status(200).json({ success: true });
        }
    } catch (err) {
        console.log(err);
    }
}

const fanwallStorage = multer.diskStorage({
    destination: "./public/uploads/fanwall/",
    filename: function (req, file, cb) {
        cb(null, "Fanwall-" + Date.now() + path.extname(file.originalname));
    }
});

const uploadFanwall = multer({
    storage: fanwallStorage,
    limits: { fileSize: 100 * 1024 * 1024 },

}).single("file");

export const uploadFile = (req: Request, res: Response) => {
    uploadFanwall(req, res, () => {
        res.status(200).json({ success: true, path: "uploads/fanwall/" + req.file?.filename });
    });
}

export const fanwallGetByDareMeId = async (req: Request, res: Response) => {
    try {
        const { daremeId } = req.params;
        const dareme = await DareMe.findById(daremeId)
            .populate({ path: 'owner', select: { 'avatar': 1, 'name': 1, 'personalisedUrl': 1 } })
            .populate({ path: 'options.option', select: { 'title': 1, 'win': 1 } })
            .select({ 'teaser': 1, 'cover': 1, 'sizeType': 1, 'options': 1 });
        const fanwall = await Fanwall.findOne({ dareme: daremeId });
        return res.status(200).json({ success: true, dareme: dareme, fanwall: fanwall });
    } catch (err) {
        console.log(err);
    }
}

export const fanwallGetByFundMeId = async (req: Request, res: Response) => {
    try {
        const { fundmeId } = req.params;
        const fundme = await FundMe.findById(fundmeId)
            .populate({ path: 'owner', select: { 'avatar': 1, 'name': 1, 'personalisedUrl': 1 } })
            .populate({ path: 'options.option', select: { 'title': 1, 'win': 1 } })
            .select({ 'teaser': 1, 'cover': 1, 'sizeType': 1, 'options': 1 });
        const fanwall = await Fanwall.findOne({ fundme: fundmeId });
        return res.status(200).json({ success: true, fundme: fundme, fanwall: fanwall });
    } catch (err) {
        console.log(err);
    }
}


export const getPostDetail = async (req: Request, res: Response) => {
    try {
        const { fanwallId } = req.params;
        const fanwall = await Fanwall.findById(fanwallId)
            .populate({ path: 'writer', select: { 'avatar': 1, 'name': 1, 'personalisedUrl': 1 } })
            .populate({
                path: 'dareme',
                Model: DareMe,
                populate: {
                    path: 'options.option',
                    model: Option
                },
                select: { 'options': 1, 'title': 1, 'category': 1 }
            });
        const winOption = fanwall.dareme.options.filter((option: any) => option.option.win === true)[0].option;
        const option = await Option.findById(winOption._id).populate({ path: 'writer', select: { 'name': 1 } });
        const dareme = await DareMe.findById(fanwall.dareme._id)
            .populate({
                path: "options.option",
                Model: Option,
                populate: {
                    path: 'voteInfo.voter',
                    Model: User
                }
            });
        const options = dareme.options;
        let voteInfo: {
            id: any,
            name: string,
            donuts: number,
            date: Date,
            avatar: string,
            personalisedUrl: string
        }[] = [];
        options.forEach((option: any) => {
            option.option.voteInfo.forEach((vote: any) => {
                let filters = voteInfo.filter((voteinfo: any) => (voteinfo.id + "" === vote.voter._id + ""));
                if (filters.length) {
                    let foundIndex = voteInfo.findIndex(vote => (vote.id + "" === filters[0].id + ""));
                    let item = {
                        id: filters[0].id,
                        donuts: filters[0].donuts + vote.donuts,
                        name: vote.voter.name,
                        avatar: vote.voter.avatar,
                        date: filters[0].date > vote.date ? vote.date : filters[0].date,
                        personalisedUrl: vote.voter.personalisedUrl
                    };
                    voteInfo[foundIndex] = item;
                } else {
                    voteInfo.push({
                        id: vote.voter._id,
                        donuts: vote.donuts,
                        name: vote.voter.name,
                        avatar: vote.voter.avatar,
                        date: vote.date,
                        personalisedUrl: vote.voter.personalisedUrl
                    });
                }
            });
        });
        voteInfo.sort((first: any, second: any) => {
            return first.donuts < second.donuts ? 1 : first.donuts > second.donuts ? -1 :
                first.date > second.date ? 1 : first.date < second.date ? -1 : 0;
        });
        return res.status(200).json({
            success: true,
            fanwall: fanwall,
            winOption: option,
            topFuns: voteInfo.slice(0, 3)
        });
    } catch (err) {
        console.log(err);
    }
}

export const getFanwallsByPersonalUrl = async (req: Request, res: Response) => {
    try {
        const { url } = req.body;
        let resFanwalls = <Array<any>>[];
        const user = await User.findOne({ personalisedUrl: url });
        const rewardFanwalls = await Fanwall.find({ posted: true }).where('owner').ne(user._id)
            .populate({ path: 'writer', select: { 'avatar': 1, 'name': 1, 'personalisedUrl': 1 } })
            .populate({
                path: 'dareme',
                Model: DareMe,
                populate: {
                    path: 'options.option',
                    model: Option
                },
                select: { 'options': 1, 'title': 1, 'category': 1 }
            });
        rewardFanwalls.forEach((fanwall: any) => {
            const options = fanwall.dareme.options.filter((option: any) => option.option.win === true);
            let isVoted = false;
            for (let i = 0; i < options[0].option.voteInfo.length; i++) {
                const voteInfo = options[0].option.voteInfo[i];
                if ((voteInfo.voter + "" === user.id + "") && voteInfo.donuts >= 50) {
                    isVoted = true;
                    break;
                }
            }
            if (isVoted) {
                let totalDonuts = 0;
                fanwall.dareme.options.forEach((option: any) => { if (option.option.status === 1) totalDonuts += option.option.donuts; });
                resFanwalls.push({
                    id: fanwall._id,
                    date: fanwall.date,
                    writer: fanwall.writer,
                    video: fanwall.video,
                    cover: fanwall.cover,
                    sizeType: fanwall.sizeType,
                    message: fanwall.message,
                    embedUrl: fanwall.embedUrl,
                    unlocks: fanwall.unlocks,
                    dareme: {
                        title: fanwall.dareme.title,
                        category: fanwall.dareme.category,
                        donuts: totalDonuts,
                        options: fanwall.dareme.options
                    },
                    userFanwall: false
                });
            }
        });

        const fanwalls = await Fanwall.find({ writer: user._id, posted: true })
            .populate({ path: 'writer', select: { 'avatar': 1, 'name': 1, 'personalisedUrl': 1 } })
            .populate({
                path: 'dareme',
                Model: DareMe,
                populate: {
                    path: 'options.option',
                    model: Option
                },
                select: { 'options': 1, 'title': 1, 'category': 1 }
            });
        fanwalls.forEach((fanwall: any) => {
            let totalDonuts = 0;
            fanwall.dareme.options.forEach((option: any) => { if (option.option.status === 1) totalDonuts += option.option.donuts; });
            resFanwalls.push({
                id: fanwall._id,
                date: fanwall.date,
                writer: fanwall.writer,
                video: fanwall.video,
                cover: fanwall.cover,
                sizeType: fanwall.sizeType,
                message: fanwall.message,
                embedUrl: fanwall.embedUrl,
                unlocks: fanwall.unlocks,
                dareme: {
                    title: fanwall.dareme.title,
                    category: fanwall.dareme.category,
                    donuts: totalDonuts,
                    options: fanwall.dareme.options
                },
                userFanwall: true
            });
        });
        return res.status(200).json({ success: true, fanwalls: resFanwalls });
    } catch (err) {
        console.log(err);
    }
}

export const likeFanwall = async (req: Request, res: Response) => {
    try {
        const { userId, fanwallId } = req.body;
        const fanwall = await Fanwall.findById(fanwallId);
        const filters = fanwall.likes.filter((like: any) => (like.liker + "") === (userId + ""));
        if (filters.length) {
            return res.status(200).json({ success: false });
        } else {
            let likes = fanwall.likes;
            likes.push({ liker: userId });
            await Fanwall.findByIdAndUpdate(fanwallId, { likes: likes });
            const resFanwall = await Fanwall.findById(fanwallId)
                .populate({ path: 'writer', select: { 'avatar': 1, 'name': 1, 'personalisedUrl': 1 } })
                .populate({
                    path: 'dareme',
                    Model: DareMe,
                    populate: {
                        path: 'options.option',
                        model: Option
                    },
                    select: { 'options': 1, 'title': 1, 'category': 1 }
                });
            return res.status(200).json({ success: true, fanwall: resFanwall });
        }
    } catch (err) {
        console.log(err);
    }
}

export const unlockFanwall = async (req: Request, res: Response) => {
    try {
        const { userId, fanwallId } = req.body;
        const user = await User.findById(userId);
        let wallet = user.wallet - 450;
        const updatedUser = await User.findByIdAndUpdate(userId, { wallet: wallet }, { new: true });
        req.body.io.to(user.email).emit("wallet_change", wallet);
        const fanwall = await Fanwall.findById(fanwallId);
        const owner = await User.findById(fanwall.writer);
        wallet = owner.wallet + 450;
        await User.findByIdAndUpdate(owner._id, { wallet: wallet });
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
        req.body.io.to(owner.email).emit("wallet_change", wallet);
        const adminDonuts = await AdminWallet.findOne({ admin: "ADMIN" });
        wallet = adminDonuts.wallet + 50;
        await AdminWallet.findOneAndUpdate({ admin: "ADMIN" }, { wallet: wallet });
        req.body.io.to("ADMIN").emit("wallet_change", wallet);
        let unlocks = fanwall.unlocks;
        unlocks.push({ unlocker: userId });
        await Fanwall.findByIdAndUpdate(fanwallId, { unlocks: unlocks });
        const resFanwall = await Fanwall.findById(fanwallId)
            .populate({ path: 'writer', select: { 'avatar': 1, 'name': 1, 'personalisedUrl': 1 } })
            .populate({
                path: 'dareme',
                Model: DareMe,
                populate: {
                    path: 'options.option',
                    model: Option
                },
                select: { 'options': 1, 'title': 1, 'category': 1 }
            });
        return res.status(200).json({ success: true, fanwall: resFanwall, user: payload });
    } catch (err) {
        console.log(err);
    }
}

export const deleteFanwall = async (req: Request, res: Response) => {
    try {
        const { fanwallId } = req.params;
        const fanwall = await Fanwall.findById(fanwallId);
        if (fanwall.video) {
            const filePath = "public/" + fanwall.video;
            fs.unlink(filePath, (err) => {
                if (err) throw err;
            });
        }
        if (fanwall.cover) {
            const filePath = "public/" + fanwall.cover;
            fs.unlink(filePath, (err) => {
                if (err) throw err;
            });
        }
        await Fanwall.findByIdAndDelete(fanwallId);
        return res.status(200).json({ success: true });
    } catch (err) {
        console.log(err);
    }
}