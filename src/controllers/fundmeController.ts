import { Request, Response } from "express";
// import path from "path";
// import multer from "multer";
import fs from "fs";
import FundMe from "../models/FundMe";
import User from "../models/User";
import Fanwall from "../models/Fanwall";
import AdminWallet from "../models/AdminWallet";
// import Notification from "../models/Notification";
import AdminUserTransaction from "../models/AdminUserTransaction";

function calcTime() {
    var d = new Date();
    var utc = d.getTime();
    var nd = new Date(utc + (3600000 * 8));
    return nd;
}

export const getDraftFundme = (req: Request, res: Response) => {
    const { userId } = req.body;
    FundMe.findOne({ owner: userId, published: false })
        .then((fundme: any) => {
            if (fundme) {
                res.status(200).json({ isDraft: true, fundme: fundme });
            } else res.status(200).json({ isDraft: false });
        }).catch((err: any) => console.log(err));
}

export const saveFundme = async (req: Request, res: Response) => {
    try {
        const { fundme, userId } = req.body;
        fundme.owner = userId;
        const resFundme = await FundMe.findOne({ owner: userId, published: false });
        if (resFundme) {
            if (resFundme.teaser && resFundme.teaser !== fundme.teaser) {
                const filePath = "public/" + resFundme.teaser;
                fs.unlink(filePath, (err) => {
                    if (err) throw err;
                });
            }
            if (resFundme.cover && resFundme.cover !== fundme.cover) {
                const filePath = "public/" + resFundme.cover;
                fs.unlink(filePath, (err) => {
                    if (err) throw err;
                });
            }
            const updatedFundme = await FundMe.findByIdAndUpdate(resFundme._id, {
                title: fundme.title,
                teaser: fundme.teaser,
                cover: fundme.cover,
                deadline: fundme.deadline,
                category: fundme.category,
                reward: fundme.reward,
                rewardText: fundme.rewardText,
                goal: fundme.goal,
                sizeType: fundme.sizeType,
                coverIndex: fundme.coverIndex
            }, { new: true });
            const resultFundme = await FundMe.findById(updatedFundme._id);
            if (resultFundme) res.status(200).json({ success: true, fundme: resultFundme });
        } else {
            fundme.published = false;
            const newFundme = new FundMe(fundme);
            const resNewFundme = await newFundme.save();

            const resultFundme = await FundMe.findById(resNewFundme._id);
            if (resultFundme) res.status(200).json({ success: true, fundme: resultFundme });
        }
    } catch (err: any) {
        console.log(err);
    }
}

export const deleteFundme = async (req: Request, res: Response) => {
    try {
        const { fundmeId } = req.params;
        const fundme = await FundMe.findById(fundmeId);
        if (fundme.teaser) {
            const filePath = "public/" + fundme.teaser;
            fs.unlink(filePath, (err) => {
                if (err) throw err;
            })
        }
        if (fundme.cover) {
            const filePath = "public/" + fundme.cover;
            fs.unlink(filePath, (err) => {
                if (err) throw err;
            });
        }
        await FundMe.findByIdAndDelete(fundmeId);
        return res.status(200).json({ success: true });
    } catch (err) {
        console.log(err);
    }
}

export const publishFundme = async (req: Request, res: Response) => {
    try {
        const { userId } = req.body;
        const fundme = await FundMe.findOne({ owner: userId, published: false });
        const updatedFundme = await FundMe.findByIdAndUpdate(fundme._id, { published: true, date: calcTime() }, { new: true });

        const admins = await User.find({ role: 'ADMIN' });
        // let new_notification = new Notification({
        //     sender: admins[0],
        //     receivers: [userId],
        //     message: `<strong>"${fundme.title}"</strong> is now live! Share on socials & get your fans to join.`,
        //     theme: 'Congrats',
        //     fundme: updatedFundme._id,
        //     type: "create_fundme",
        // });

        // await User.findOneAndUpdate({ _id: userId }, { new_notification: true });
        // await new_notification.save();

        // const user = await User.findOne({ _id: userId }).populate({ path: 'subscribed_users' });
        // if (user.subscribed_users.length) {
        // new_notification = new Notification({
        //     sender: userId,
        //     receivers: user.subscribed_users.map((sub_user: any) => sub_user._id),
        //     message: `<strong>"${user.name}"</strong> created <strong>"${fundme.title}"</strong>, go Fund & support him now!`,
        //     theme: 'A new FundMe',
        //     fundme: updatedFundme._id,
        //     type: "create_fundme",
        // })
        // await new_notification.save();
        //     user.subscribed_users.forEach(async (sub_user: any) => {
        //         await User.findByIdAndUpdate(sub_user._id, { new_notification: true });
        //         req.body.io.to(sub_user.email).emit("create_notification");
        //     });
        // }
        // req.body.io.to(user.email).emit("create_notification");
        return res.status(200).json({ success: true });
    } catch (err) {
        console.log(err)
    }
}

export const checkFundMeFinished = async (req: Request, res: Response) => {
    try {
        const { fundmeId } = req.params;
        const fundme = await FundMe.findById(fundmeId);
        return res.status(200).json({ finished: fundme.finished });
    } catch (err) {
        console.log(err);
    }
}

export const getFundmeDetails = async (req: Request, res: Response) => {
    try {
        const { fundmeId } = req.params;
        const fundme = await FundMe.findById(fundmeId)
            .populate({ path: 'owner', select: { 'avatar': 1, 'personalisedUrl': 1, 'name': 1, '_id': 1 } })
            .select({ 'published': 0, '__v': 0 });
        if (fundme) {
            const result = {
                _id: fundme._id,
                owner: fundme.owner,
                title: fundme.title,
                deadline: fundme.deadline,
                category: fundme.category,
                teaser: fundme.teaser,
                goal: fundme.goal,
                reward: fundme.reward,
                rewardText: fundme.rewardText,
                wallet: fundme.wallet,
                cover: fundme.cover,
                sizeType: fundme.sizeType,
                finished: fundme.finished,
                voteInfo: fundme.voteInfo,
                time: (new Date(fundme.date).getTime() - new Date(calcTime()).getTime() + 24 * 1000 * 3600 * fundme.deadline + 1000 * 60) / (24 * 3600 * 1000),
            };
            return res.status(200).json({ success: true, fundme: result });
        }
    } catch (err) {
        console.log(err);
    }
}

export const fundCreator = async (req: Request, res: Response) => {
    try {
        const { fundmeId, amount, userId } = req.body;
        const user = await User.findById(userId);
        const fundme = await FundMe.findById(fundmeId).populate({ path: 'owner' });

        let voteInfo = fundme.voteInfo;
        let filters = voteInfo.filter((vote: any) => (vote.voter + "") === (userId + ""));
        if (filters.length) {
            voteInfo = voteInfo.map((vote: any) => {
                if ((vote.voter + "") === (userId + "")) {
                    if (amount !== 1) vote.donuts = vote.donuts + amount;
                    else vote.canFree = false;
                }
                return vote;
            });
        } else voteInfo.push({ voter: userId, donuts: amount > 1 ? amount : 0, canFree: amount === 1 ? false : true });

        let fundmeWallet = fundme.wallet + amount;
        const updateFundme = await FundMe.findByIdAndUpdate(fundme._id, { wallet: fundmeWallet, voteInfo: voteInfo }, { new: true }).populate({ path: 'owner' });
        const daremePayload = {
            _id: updateFundme._id,
            owner: updateFundme.owner,
            title: updateFundme.title,
            deadline: updateFundme.deadline,
            category: updateFundme.category,
            teaser: updateFundme.teaser,
            goal: updateFundme.goal,
            reward: updateFundme.reward,
            rewardText: updateFundme.rewardText,
            wallet: updateFundme.wallet,
            cover: updateFundme.cover,
            sizeType: updateFundme.sizeType,
            finished: updateFundme.finished,
            voteInfo: updateFundme.voteInfo,
            time: (new Date(updateFundme.date).getTime() - new Date(calcTime()).getTime() + 24 * 1000 * 3600 * updateFundme.deadline + 1000 * 60) / (24 * 3600 * 1000),
        }
        if (amount === 1) {
            const adminWallet = await AdminWallet.findOne({ admin: "ADMIN" });
            const adminDonuts = adminWallet.wallet - 1;
            await AdminWallet.findOneAndUpdate({ admin: "ADMIN" }, { wallet: adminDonuts });
            req.body.io.to("ADMIN").emit("wallet_change", adminDonuts);
            const transaction = new AdminUserTransaction({
                description: 3,
                from: "ADMIN",
                to: "FUNDME",
                user: userId,
                fundme: fundmeId,
                donuts: 1,
                date: calcTime()
            });
            await transaction.save();
            return res.status(200).json({ success: true, fundme: daremePayload });
        } else {
            const userWallet = user.wallet - amount;
            const updatedUser = await User.findByIdAndUpdate(user._id, { wallet: userWallet }, { new: true });
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
            const transaction = new AdminUserTransaction({
                description: 6,
                from: "USER",
                to: "FUNDME",
                user: userId,
                fundme: fundmeId,
                donuts: amount,
                date: calcTime()
            });
            await transaction.save();
            req.body.io.to(updatedUser.email).emit("wallet_change", updatedUser.wallet);
            return res.status(200).json({ success: true, fundme: daremePayload, user: payload });
        }


        //new notification
        // const new_notification = new Notification({
        //     sender: userId,
        //     receivers: [fundme.owner],
        //     message: `<strong>"${user.name}"</strong> dared you in <strong>"${fundme.title}"</strong>, check it out.`,
        //     theme: "New proposed Dare",
        //     fundme: fundmeId,
        //     type: "ongoing_fundme"
        // })
        // await new_notification.save();
        // req.body.io.to(fundme.owner.email).emit("create_notification");
        //end
    } catch (err) {
        console.log(err);
    }
}

export const checkOngoingfundmes = async (io: any) => {
    try {
        const fundmes = await FundMe.find({ published: true }).where('finished').equals(false);
        for (const fundme of fundmes) {
            if ((new Date(fundme.date).getTime() + 1000 * 3600 * 24 * fundme.deadline) < new Date(calcTime()).getTime()) {
                await FundMe.findByIdAndUpdate(fundme._id, { finished: true }, { new: true });
            }
        }
    } catch (err: any) {
        console.log(err);
    }
}

// const coverStorage = multer.diskStorage({
//     destination: "./public/uploads/cover/",
//     filename: function (req, file, cb) {
//         cb(null, "Cover-" + Date.now() + path.extname(file.originalname));
//     }
// });

// const uploadCover = multer({
//     storage: coverStorage,
//     limits: { fileSize: 30 * 1024 * 1024 },
// }).single("file");

// export const selectCover = (req: Request, res: Response) => {
//     uploadCover(req, res, () => {
//         res.status(200).json({ success: true, path: "uploads/cover/" + req.file?.filename });
//     });
// }

// const teaserStorage = multer.diskStorage({
//     destination: "./public/uploads/teaser/",
//     filename: function (req, file, cb) {
//         cb(null, "Teaser-" + Date.now() + path.extname(file.originalname));
//     }
// });

// const uploadTeaser = multer({
//     storage: teaserStorage,
//     limits: { fileSize: 30 * 1024 * 1024 },
// }).single("file");

// export const uploadFile = (req: Request, res: Response) => {
//     uploadTeaser(req, res, () => {
//         res.status(200).json({ success: true, path: "uploads/teaser/" + req.file?.filename });
//     });
// }

export const getfundmesByPersonalUrl = async (req: Request, res: Response) => {
    try {
        const { url } = req.body;
        const resultFundmes: Array<object> = [];
        const user = await User.findOne({ personalisedUrl: url }).select({ 'name': 1, 'avatar': 1, 'personalisedUrl': 1, 'categories': 1, 'subscribed_users': 1 });
        const userFundmes = await FundMe.find({ owner: user._id, published: true, show: true })
            .populate({ path: 'owner', select: { 'name': 1, 'avatar': 1, 'personalisedUrl': 1, 'status': 1 } })
            .populate({ path: 'options.option', select: { 'donuts': 1, '_id': 0, 'status': 1 } })
            .select({ 'published': 0, 'wallet': 0, '__v': 0 });

        userFundmes.filter((userFundme: any) => userFundme.finished === false).sort((first: any, second: any) => {
            return new Date(first.date).getTime() > new Date(second.date).getTime() ? 1 : new Date(first.date).getTime() < new Date(second.date).getTime() ? -1 : 0;
        }).forEach((fundme: any) => {
            let donuts = 0;
            if (fundme.options) fundme.options.forEach((option: any) => { if (option.option.status === 1) donuts += option.option.donuts; });
            resultFundmes.push({
                _id: fundme._id,
                owner: fundme.owner,
                title: fundme.title,
                deadline: fundme.deadline,
                category: fundme.category,
                teaser: fundme.teaser,
                donuts: donuts,
                cover: fundme.cover,
                sizeType: fundme.sizeType,
                isUserfundme: true,
                finished: fundme.finished,
                time: (new Date(fundme.date).getTime() - new Date(calcTime()).getTime() + 24 * 1000 * 3600 * fundme.deadline) / (24 * 3600 * 1000),
            });
        });

        userFundmes.filter((userFundme: any) => userFundme.finished === true).sort((first: any, second: any) => {
            return new Date(first.date).getTime() > new Date(second.date).getTime() ? 1 : new Date(first.date).getTime() < new Date(second.date).getTime() ? -1 : 0;
        }).forEach((fundme: any) => {
            let donuts = 0;
            if (fundme.options) fundme.options.forEach((option: any) => { if (option.option.status === 1) donuts += option.option.donuts; });
            resultFundmes.push({
                _id: fundme._id,
                owner: fundme.owner,
                title: fundme.title,
                deadline: fundme.deadline,
                category: fundme.category,
                teaser: fundme.teaser,
                donuts: donuts,
                cover: fundme.cover,
                sizeType: fundme.sizeType,
                isUserfundme: true,
                finished: fundme.finished,
                time: (new Date(fundme.date).getTime() - new Date(calcTime()).getTime() + 24 * 1000 * 3600 * fundme.deadline) / (24 * 3600 * 1000),
            });
        });

        const daredFundmes = await FundMe.find({ published: true, show: true })
            .where('owner').ne(user._id)
            .populate({ path: 'owner', select: { 'name': 1, 'avatar': 1, 'personalisedUrl': 1 } })
            .populate({ path: 'options.option', select: { 'donuts': 1, '_id': 0, 'writer': 1, 'status': 1, 'voteInfo': 1 } })
            .select({ 'published': 0, 'wallet': 0, '__v': 0 });

        daredFundmes.filter((daredFundme: any) => daredFundme.finished === false).sort((first: any, second: any) => {
            return new Date(first.date).getTime() > new Date(second.date).getTime() ? 1 : new Date(first.date).getTime() < new Date(second.date).getTime() ? -1 : 0;
        }).forEach((fundme: any) => {
            var isWriter = false;
            for (let i = 0; i < fundme.options.length; i++) {
                if ((fundme.options[i].option.writer + "") === (user._id + "") && fundme.options[i].option.status === 1) {
                    isWriter = true;
                    break;
                }
                for (let j = 0; j < fundme.options[i].option.voteInfo.length; j++) {
                    if ((fundme.options[i].option.voteInfo[j].voter + "") === (user._id + "")) {
                        isWriter = true;
                        break;
                    }
                }
                if (isWriter) break;
            }
            if (isWriter === true) {
                let donuts = 0;
                fundme.options.forEach((option: any) => { if (option.option.status === 1) donuts += option.option.donuts; });
                resultFundmes.push({
                    _id: fundme._id,
                    owner: fundme.owner,
                    title: fundme.title,
                    deadline: fundme.deadline,
                    category: fundme.category,
                    teaser: fundme.teaser,
                    donuts: donuts,
                    cover: fundme.cover,
                    sizeType: fundme.sizeType,
                    finished: fundme.finished,
                    isUserfundme: false,
                    time: (new Date(fundme.date).getTime() - new Date(calcTime()).getTime() + 24 * 1000 * 3600 * fundme.deadline + 1000 * 60) / (24 * 3600 * 1000),
                });
            }
        });

        daredFundmes.filter((daredFundme: any) => daredFundme.finished === true).sort((first: any, second: any) => {
            return new Date(first.date).getTime() > new Date(second.date).getTime() ? 1 : new Date(first.date).getTime() < new Date(second.date).getTime() ? -1 : 0;
        }).forEach((fundme: any) => {
            var isWriter = false;
            for (let i = 0; i < fundme.options.length; i++) {
                if ((fundme.options[i].option.writer + "") === (user._id + "") && fundme.options[i].option.status === 1) {
                    isWriter = true;
                    break;
                }
                for (let j = 0; j < fundme.options[i].option.voteInfo.length; j++) {
                    if ((fundme.options[i].option.voteInfo[j].voter + "") === (user._id + "")) {
                        isWriter = true;
                        break;
                    }
                }
                if (isWriter) break;
            }
            if (isWriter === true) {
                let donuts = 0;
                fundme.options.forEach((option: any) => { if (option.option.status === 1) donuts += option.option.donuts; });
                resultFundmes.push({
                    _id: fundme._id,
                    owner: fundme.owner,
                    title: fundme.title,
                    deadline: fundme.deadline,
                    category: fundme.category,
                    teaser: fundme.teaser,
                    donuts: donuts,
                    cover: fundme.cover,
                    sizeType: fundme.sizeType,
                    finished: fundme.finished,
                    isUserfundme: false,
                    time: (new Date(fundme.date).getTime() - new Date(calcTime()).getTime() + 24 * 1000 * 3600 * fundme.deadline + 1000 * 60) / (24 * 3600 * 1000),
                });
            }
        });
        return res.status(200).json({ fundmes: resultFundmes, user: user });
    } catch (err) {
        console.log(err);
    }
}

// export const getFundmesOngoing = async (req: Request, res: Response) => {
//     try {
//         const fundmes = await FundMe.find({ published: true, show: true })
//             .populate({ path: 'owner', select: { 'avatar': 1, 'personalisedUrl': 1, 'name': 1 } })
//             .populate({ path: 'options.option', select: { 'donuts': 1, '_id': 0, 'status': 1 } })
//             .select({ 'published': 0, 'wallet': 0, '__v': 0 });
//         let resFundmes = <Array<any>>[];
//         for (const fundme of fundmes) {
//             let donuts = 0;
//             const fanwall = await Fanwall.findOne({ fundme: fundme._id });
//             fundme.options.forEach((option: any) => { if (option.option.status === 1) donuts += option.option.donuts; });
//             resFundmes.push({
//                 id: fundme._id,
//                 owner: fundme.owner,
//                 title: fundme.title,
//                 deadline: fundme.deadline,
//                 category: fundme.category,
//                 teaser: fundme.teaser,
//                 donuts: donuts,
//                 finished: fundme.finished,
//                 sizeType: fundme.sizeType,
//                 cover: fundme.cover,
//                 date: fundme.date,
//                 fanwall: fanwall ? fanwall.posted : false,
//                 time: (new Date(fundme.date).getTime() - new Date(calcTime()).getTime() + 24 * 1000 * 3600 * fundme.deadline) / (24 * 3600 * 1000),
//             });
//         }

//         const fanwalls = await Fanwall.find({ posted: true })
//             .populate({ path: 'writer', select: { 'avatar': 1, 'personalisedUrl': 1, 'name': 1 } })
//             .populate({
//                 path: 'fundme',
//                 Model: FundMe,
//                 select: {
//                     'title': 1, 'deadline': 1, 'category': 1
//                 },
//                 populate: {
//                     path: 'options.option',
//                     model: Option
//                 }
//             });
//         let resFanwalls = <Array<any>>[];
//         fanwalls.sort((first: any, second: any) => {
//             return first.date < second.date ? 1 : first.date > second.date ? -1 : 0;
//         }).forEach((fanwall: any) => {
//             let totalDonuts = 0;
//             fanwall.fundme.options.forEach((option: any) => { if (option.option.status === 1) totalDonuts += option.option.donuts; });
//             resFanwalls.push({
//                 'id': fanwall._id,
//                 'date': fanwall.date,
//                 'writer': fanwall.writer,
//                 'video': fanwall.video,
//                 'sizeType': fanwall.sizeType,
//                 'cover': fanwall.cover,
//                 'message': fanwall.message,
//                 'embedUrl': fanwall.embedUrl,
//                 'unlocks': fanwall.unlocks,
//                 'fundme': {
//                     'title': fanwall.fundme.title,
//                     'options': fanwall.fundme.options,
//                     'category': fanwall.fundme.category,
//                     'donuts': totalDonuts
//                 }
//             });
//         });

//         return res.status(200).json({ fundmes: resFundmes, fanwalls: resFanwalls });
//     } catch (err) {
//         console.log(err);
//     }
// }

export const getFundmeResult = async (req: Request, res: Response) => {
    try {
        const { fundmeId } = req.params;
        const fundme = await FundMe.findById(fundmeId)
            .populate([{ path: 'owner', select: { 'avatar': 1, 'personalisedUrl': 1, 'name': 1, '_id': 1 } }, { path: 'voteInfo.voter', select: { '_id': 0, 'name': 1, 'canFee': 1 } }])
            .select({ 'finished': 0, 'published': 0, '__v': 0 });
        if (fundme) {
            const fanwall = await Fanwall.findOne({ fundme: fundme._id }).select({ '__v': 0, 'data': 0 });
            // let donuts = 0;
            const result = {
                _id: fundme._id,
                owner: fundme.owner,
                title: fundme.title,
                deadline: fundme.deadline,
                category: fundme.category,
                teaser: fundme.teaser,
                goal: fundme.goal,
                reward: fundme.reward,
                rewardText: fundme.rewardText,
                wallet: fundme.wallet,
                cover: fundme.cover,
                sizeType: fundme.sizeType,
                finished: fundme.finished,
                voteInfo: fundme.voteInfo,
                time: (new Date(fundme.date).getTime() - new Date(calcTime()).getTime() + 24 * 1000 * 3600 * fundme.deadline + 1000 * 60) / (24 * 3600 * 1000),
            };
            return res.status(200).json({ success: true, fundme: result, fanwall: fanwall });
        }
    } catch (err) {
        console.log(err);
    }
}

// export const getOptionDetails = async (req: Request, res: Response) => {
//     try {
//         const { optionId, fundmeId } = req.params;
//         const fundme = await FundMe.findById(fundmeId)
//             .populate({ path: 'owner', select: { 'avatar': 1, 'personalisedUrl': 1, 'name': 1 } })
//             .populate({ path: 'options.option' })
//             .select({ 'teaser': 1, 'options': 1, 'title': 1, 'cover': 1, 'sizeType': 1 });
//         const resFundme = {
//             _id: fundme._id,
//             owner: fundme.owner,
//             teaser: fundme.teaser,
//             title: fundme.title,
//             cover: fundme.cover,
//             sizeType: fundme.sizeType,
//             options: fundme.options
//         };
//         const option = await Option.findById(optionId)
//             .select({ 'donuts': 1, 'title': 1 })
//             .populate({ path: 'writer', select: { 'avatar': 1, 'personalisedUrl': 1, 'name': 1, '_id': 0 } });
//         if (option) res.status(200).json({ option: option, fundme: resFundme, success: true });
//     } catch (err) {
//         console.log(err);
//     }
// }

// export const supportCreator = async (req: Request, res: Response) => {
//     try {
//         const { userId, fundmeId, optionId, amount } = req.body;
//         const option = await Option.findById(optionId);
//         let voteInfo = option.voteInfo;
//         let totalDonuts = option.donuts + amount;
//         let totalVoters = option.voters;
//         let filters = voteInfo.filter((option: any) => (option.voter + "") === (userId + ""));
//         if (filters.length) {
//             voteInfo = voteInfo.map((option: any) => {
//                 if ((option.voter + "") === (userId + "")) {
//                     if (amount === 50) option.donuts = option.donuts + 50;
//                     else option.canFree = false;
//                 }
//                 return option;
//             });
//         } else {
//             totalVoters = totalVoters + 1;
//             voteInfo.push({ voter: userId, donuts: amount > 1 ? amount : 0, canFree: amount === 1 ? false : true });
//         }
//         const optionNew = await Option.findByIdAndUpdate(option._id, { donuts: totalDonuts, voters: totalVoters, voteInfo: voteInfo }, { new: true })
//             .select({ 'donuts': 1, 'title': 1 })
//             .populate({ path: 'writer', select: { 'avatar': 1, 'personalisedUrl': 1, 'name': 1, '_id': 0 } });

//         const fundme = await FundMe.findById(fundmeId).populate({ path: 'owner' });
//         const fundmeWallet = fundme.wallet + amount;
//         const updatedFundme = await FundMe.findByIdAndUpdate(fundmeId, { wallet: fundmeWallet }, { new: true })
//             .populate({ path: 'owner', select: { 'avatar': 1, 'personalisedUrl': 1, 'name': 1 } })
//             .populate({ path: 'options.option' })
//             .select({ 'teaser': 1, 'options': 1, 'title': 1, 'cover': 1, 'sizeType': 1 });
//         const resFundme = {
//             _id: updatedFundme._id,
//             owner: updatedFundme.owner,
//             teaser: updatedFundme.teaser,
//             title: updatedFundme.title,
//             cover: updatedFundme.cover,
//             sizeType: updatedFundme.sizeType,
//             options: updatedFundme.options
//         };
//         const user = await User.findById(userId);

//         if (amount === 1) {
//             const adminWallet = await AdminWallet.findOne({ admin: "ADMIN" });
//             const adminDonuts = adminWallet.wallet - 1;
//             await AdminWallet.findOneAndUpdate({ admin: "ADMIN" }, { wallet: adminDonuts });
//             req.body.io.to("ADMIN").emit("wallet_change", adminDonuts);
//             const transaction = new AdminUserTransaction({
//                 description: 3,
//                 from: "ADMIN",
//                 to: "FUNDME",
//                 user: userId,
//                 fundme: fundmeId,
//                 donuts: 1,
//                 date: calcTime()
//             });
//             await transaction.save();
//             return res.status(200).json({ success: true, fundme: resFundme, option: optionNew });
//         }

//         if (amount === 50) {
//             let wallet = user.wallet - 50;
//             const updatedUser = await User.findByIdAndUpdate(userId, { wallet: wallet }, { new: true });
//             const payload = {
//                 id: updatedUser._id,
//                 name: updatedUser.name,
//                 avatar: updatedUser.avatar,
//                 role: updatedUser.role,
//                 email: updatedUser.email,
//                 wallet: updatedUser.wallet,
//                 personalisedUrl: updatedUser.personalisedUrl,
//                 language: updatedUser.language,
//                 category: updatedUser.categories,
//                 new_notification: updatedUser.new_notification,
//             };
//             req.body.io.to(updatedUser.email).emit("wallet_change", updatedUser.wallet);
//             const transaction = new AdminUserTransaction({
//                 description: 5,
//                 from: "USER",
//                 to: "FUNDME",
//                 user: userId,
//                 fundme: fundmeId,
//                 donuts: 50,
//                 date: calcTime()
//             });
//             await transaction.save();
//             return res.status(200).json({ success: true, fundme: resFundme, option: optionNew, user: payload });
//         }

//         //create notification
//         let new_notification = new Notification({
//             sender: userId,
//             receivers: [fundme.owner],
//             message: `<strong>"${user.name}"</strong> supported <strong>"${option.title}"</strong> with ${amount} Donuts.`,
//             them: "new vote",
//             type: "ongoing_fundme",
//             fundme: fundme._id,
//         });
//         await new_notification.save();
//         req.body.io.to(fundme.owner.email).emit("create_notification");
//         //end
//     } catch (err) {
//         console.log(err);
//     }
// }

// export const getFundCreatorDetails = async (req: Request, res: Response) => {
//     try {
//         const { fundmeId } = req.params;
//         const fundme = await FundMe.findById(fundmeId).populate({ path: 'owner', select: { 'avatar': 1, 'name': 1, 'personalisedUrl': 1 } }).select({ 'title': 1, 'teaser': 1, 'cover': 1, 'sizeType': 1 });
//         return res.status(200).json({ success: true, fundme: fundme });
//     } catch (err) {
//         console.log(err);
//     }
// }

// export const checkFundMeRequests = async (req: Request, res: Response) => {
//     const { fundmeId } = req.params;
//     const fundme = await FundMe.findById(fundmeId);
//     const options = fundme.options.filter((option: any) => option.option.status !== 1);
//     return res.status(200).json({ request: options.length > 0 ? true : false });
// }

// export const getFundMeRequests = async (req: Request, res: Response) => {
//     const { fundmeId } = req.params;
//     const fundme = await FundMe.findById(fundmeId)
//         .populate({ path: 'owner', select: { 'avatar': 1, 'personalisedUrl': 1, 'name': 1 } })
//         .populate({
//             path: 'options.option',
//             model: Option,
//             populate: { path: 'writer' }
//         }).select({ 'teaser': 1, 'options': 1, 'title': 1, 'date': 1, 'deadline': 1, 'cover': 1, 'sizeType': 1 });
//     const options = fundme.options.filter((option: any) => option.option.status !== 1)
//         .sort((first: any, second: any) =>
//             first.option.status > second.option.status ? -1 :
//                 first.option.status < second.option.status ? 1 :
//                     first.option.date > second.option.date ? 1 :
//                         first.option.date < second.option.date ? -1 : 0);;
//     fundme.options = options;
//     let donuts = 0;
//     fundme.options.forEach((option: any) => { if (option.option.status === 1) donuts += option.option.donuts; });
//     const result = {
//         _id: fundme._id,
//         owner: fundme.owner,
//         title: fundme.title,
//         deadline: fundme.deadline,
//         category: fundme.category,
//         teaser: fundme.teaser,
//         donuts: donuts,
//         cover: fundme.cover,
//         sizeType: fundme.sizeType,
//         options: fundme.options,
//         finished: fundme.finished,
//         time: (new Date(fundme.date).getTime() - new Date(calcTime()).getTime() + 24 * 1000 * 3600 * fundme.deadline + 1000 * 60) / (24 * 3600 * 1000),
//     };
//     return res.status(200).json({ success: true, fundme: result });
// }

// export const acceptFundOption = (req: Request, res: Response) => {
//     const { optionId } = req.body;
//     Option.findByIdAndUpdate(optionId, { status: 1 }, { new: true })
//         .then((option: any) => {
//             if (option) return res.status(200).json({ success: true });
//         }).catch((err: any) => console.log(err));
// }

// export const declineFundOption = async (req: Request, res: Response) => {
//     try {
//         const { optionId, fundmeId } = req.body;
//         const option = await Option.findByIdAndUpdate(optionId, { status: -1 }, { new: true }).populate({ path: 'writer' });
//         const user = await User.findById(option.writer._id);
//         await User.findByIdAndUpdate(option.writer._id, { wallet: user.wallet + option.donuts });
//         const fundme = await FundMe.findById(fundmeId);
//         await FundMe.findByIdAndUpdate(fundmeId, { wallet: fundme.wallet - option.donuts });
//         req.body.io.to(option.writer.email).emit("wallet_change", user.wallet + option.donuts);
//         const transaction = new AdminUserTransaction({
//             description: 7,
//             from: "FUNDME",
//             to: "USER",
//             user: user._id,
//             fundme: fundmeId,
//             donuts: option.donuts,
//             date: calcTime()
//         });
//         await transaction.save();
//         return res.status(200).json({ success: true });
//     } catch (err) {
//         console.log(err);
//     }
// }

// export const winFundOption = async (req: Request, res: Response) => {
//     try {
//         const { optionId, fundmeId } = req.body;
//         await Option.findByIdAndUpdate(optionId, { win: true });
//         const fundme = await FundMe.findById(fundmeId).populate({ path: 'options.option', model: Option });
//         const options = fundme.options;
//         const filters = options.filter((option: any) => option.option.win === false);
//         let minusDonuts = 0;
//         for (const option of filters) {
//             for (const vote of option.option.voteInfo) {
//                 if ((option.option.writer + "") !== (vote.voter + "")) {
//                     const voter = await User.findById(vote.voter);
//                     let wallet = voter.wallet + vote.donuts;
//                     await User.findByIdAndUpdate(vote.voter, { wallet: wallet });
//                     req.body.io.to(voter.email).emit("wallet_change", wallet);
//                     const transaction = new AdminUserTransaction({
//                         description: 7,
//                         from: "FUNDME",
//                         to: "USER",
//                         user: vote.voter,
//                         fundme: fundmeId,
//                         donuts: vote.donuts,
//                         date: calcTime()
//                     });
//                     await transaction.save();
//                     minusDonuts += vote.donuts;
//                 }
//             }
//         }
//         await FundMe.findByIdAndUpdate(fundmeId, { wallet: fundme.wallet - minusDonuts });
//         return res.status(200).json({ success: true });
//     } catch (err) {
//         console.log(err);
//     }
// }

export const getFundMeList = async (req: Request, res: Response) => {
    try {
        const { search } = req.body;
        if (search === "") {
            const fundmes = await FundMe.find({ 'published': true })
                .populate({ path: 'owner', select: { 'name': 1, 'categories': 1 } })
                .select({ 'title': 1, 'category': 1, 'date': 1, 'deadline': 1, 'finished': 1, 'owner': 1, 'show': 1 });
            var result: Array<object> = [];
            for (const fundme of fundmes) {
                let time = 0.0;
                if (!fundme.finished) time = (new Date(fundme.date).getTime() - Date.now() + 3600 * 24 * fundme.deadline * 1000) / (1000 * 24 * 3600);
                result.push({
                    id: fundme._id,
                    date: fundme.date,
                    time: time,
                    finished: fundme.finished,
                    owner: fundme.owner,
                    category: fundme.category,
                    title: fundme.title,
                    wallet: fundme.wallet,
                    show: fundme.show
                });
            }
            return res.status(200).json({ success: true, fundmes: result });
        }
    } catch (err) {
        console.log(err);
    }
}

export const setFundMeShow = async (req: Request, res: Response) => {
    try {
        const { fundmeId } = req.params;
        const { show } = req.body;
        const updatedFundme = await FundMe.findByIdAndUpdate(fundmeId, { show: show }, { new: true });
        if (updatedFundme) return res.status(200).json({ success: true });
    } catch (err) {
        console.log(err);
    }
}

// export const deleteFundMe = async (req: Request, res: Response) => {
//     try {
//         const { fundmeId } = req.params;
//         const fundme = await FundMe.findById(fundmeId);
//         const options = fundme.options;
//         for (const option of options) {
//             await Option.findByIdAndDelete(option.option);
//         }
//         if (fundme.teaser) {
//             const filePath = "public/" + fundme.teaser;
//             fs.unlink(filePath, (err) => {
//                 if (err) throw err;
//             });
//         }
//         if (fundme.cover) {
//             const filePath = "public/" + fundme.cover;
//             fs.unlink(filePath, (err) => {
//                 if (err) throw err;
//             });
//         }
//         await FundMe.findByIdAndDelete(fundmeId);
//         return res.status(200).json({ success: true });
//     } catch (err) {
//         console.log(err);
//     }
// }

export const updateFundMe = async (req: Request, res: Response) => {
    try {
        const { fundmeId } = req.params;
        const { fundme } = req.body;
        const resFundme = await FundMe.findById(fundmeId);
        if (fundme.teaserFile) {
            const filePath = "public/" + resFundme.teaser;
            fs.unlink(filePath, (err) => {
                if (err) throw err;
            });
        }
        if (fundme.coverFile && resFundme.cover) {
            const filePath = "public/" + resFundme.cover;
            fs.unlink(filePath, (err) => {
                if (err) throw err;
            });
        }
        await FundMe.findByIdAndUpdate(fundmeId, {
            title: fundme.title,
            category: fundme.category,
            teaser: fundme.teaserFile ? fundme.teaserFile : resFundme.teaser,
            cover: fundme.coverFile ? fundme.coverFile : resFundme.cover,
            sizeType: fundme.teaserType !== null ? fundme.teaserType : resFundme.sizeType
        });
        return res.status(200).json({ success: true });
    } catch (err) {
        console.log(err);
    }
}

// export const deleteOption = async (req: Request, res: Response) => {
//     try {
//         const { fundmeId, optionId } = req.params;
//         await Option.findByIdAndDelete(optionId);
//         const fundme = await FundMe.findById(fundmeId);
//         const options = fundme.options.filter((option: any) => (option.option + "") !== (optionId + ""));
//         await FundMe.findByIdAndUpdate(fundmeId, { options: options });
//         const resFundme = await FundMe.findById(fundmeId)
//             .populate({ path: 'owner', select: { 'avatar': 1, 'personalisedUrl': 1, 'name': 1, '_id': 1 } })
//             .populate({
//                 path: 'options.option',
//                 model: Option,
//                 populate: { path: 'writer', select: { '_id': 0, 'name': 1 } },
//                 select: { '__v': 0, 'win': 0 },
//             }).select({ 'published': 0, 'wallet': 0, '__v': 0 });
//         return res.status(200).json({ success: true, fundme: resFundme });
//     } catch (err) {
//         console.log(err);
//     }
// }

export const getFundmeOptions = async (req: Request, res: Response) => {
    try {
        const { fundmeId } = req.params;
        const fundme = await FundMe.findById(fundmeId)
            .populate(
                { path: 'voteInfo.voter', select: { '_id': 0, 'name': 1, 'avatar': 1 } }
            );
        return res.status(200).json({ success: true, votes: fundme.voteInfo });
    } catch (err) {
        console.log(err);
    }
}