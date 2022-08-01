import { Request, Response } from "express";
import path from "path";
import multer from "multer";
import fs from "fs";
import DareMe from "../models/DareMe";
import User from "../models/User";
import Option from "../models/Option";
import Fanwall from "../models/Fanwall";
import AdminWallet from "../models/AdminWallet";
import AdminUserTransaction from "../models/AdminUserTransaction";
import FundMe from "../models/FundMe";
import { addNewNotification } from '../controllers/notificationController';

function calcTime() {
    var d = new Date();
    var utc = d.getTime();
    var nd = new Date(utc + (3600000 * 8));
    return nd;
}

export const checkOngoingdaremes = async (io: any) => {
    try {
        const daremes = await DareMe.find({ published: true }).where('finished').equals(false).populate({ path: 'options.option', model: Option });
        for (const dareme of daremes) {
            if ((new Date(dareme.date).getTime() + 1000 * 3600 * 24 * dareme.deadline) < new Date(calcTime()).getTime()) {
                await DareMe.findByIdAndUpdate(dareme._id, { finished: true }, { new: true });
                const daremeInfo = await DareMe.findById(dareme._id).populate({ path: 'options.option' });
                const options = daremeInfo.options.filter((option: any) => option.option.status === 1);
                const maxOption: any = options.reduce((prev: any, current: any) => (prev.option.donuts > current.option.donuts) ? prev : current);
                const filters = options.filter((option: any) => option.option.donuts === maxOption.option.donuts);
                if (filters.length === 1) {
                    let resDareme = await DareMe.findById(dareme._id);
                    let minusDonuts = 0;
                    await Option.findByIdAndUpdate(maxOption.option._id, { win: true }, { new: true });
                    const noWinOptions = options.filter((option: any) => option.option.donuts !== maxOption.option.donuts);
                    for (const option of noWinOptions) {
                        for (const vote of option.option.voteInfo) {
                            if ((option.option.writer + "") !== (vote.voter + "")) {
                                const voter = await User.findById(vote.voter);
                                let wallet = voter.wallet + vote.donuts;
                                await User.findByIdAndUpdate(vote.voter, { wallet: wallet });
                                io.to(voter.email).emit("wallet_change", wallet);
                                minusDonuts += vote.donuts;
                                const transaction = new AdminUserTransaction({
                                    description: 7,
                                    from: "DAREME",
                                    to: "USER",
                                    user: vote.voter,
                                    dareme: dareme._id,
                                    donuts: vote.donuts,
                                    date: calcTime()
                                });
                                await transaction.save();
                            }
                        }
                    }
                    await DareMe.findByIdAndUpdate(dareme._id, { wallet: resDareme.wallet - minusDonuts });
                }
            }
            const calc = (new Date(dareme.date).getTime() + 1000 * 3600 * 24 * (dareme.deadline - 1)) - new Date(calcTime()).getTime();
            if (calc >= -60000 && calc <= 0) {
                const options = dareme.options.filter((option: any) => option.option.status === 0);
                for (const option of options) {
                    await Option.findByIdAndUpdate(option.option._id, { status: -1 });
                    const user = await User.findById(option.option.writer);
                    await User.findByIdAndUpdate(user._id, { wallet: user.wallet + option.option.donuts });
                    const resDareme = await DareMe.findById(dareme._id);
                    await DareMe.findByIdAndUpdate(dareme._id, { wallet: resDareme.wallet - option.option.donuts });
                    io.to(user.email).emit("wallet_change", user.wallet + option.option.donuts);
                    if (option.option.donuts > 0) {
                        const transaction = new AdminUserTransaction({
                            description: 7,
                            from: "DAREME",
                            to: "USER",
                            user: user._id,
                            dareme: dareme._id,
                            donuts: option.option.donuts,
                            date: calcTime()
                        });
                        await transaction.save();
                    }
                }
            }
        }
    } catch (err: any) {
        console.log(err);
    }
}

export const publishDareme = async (req: Request, res: Response) => {
    try {
        const { userId } = req.body;
        const result = await Promise.all([
            User.findById(userId),
            DareMe.findOne({ owner: userId, published: false })
        ]);
        if (result[0].tipFunction === false) await User.findByIdAndUpdate(userId, { tipFunction: true });
        const updatedDareme = await DareMe.findByIdAndUpdate(result[1]._id, { published: true, date: calcTime() }, { new: true });

        addNewNotification(req.body.io, {
            section: 'Create DareMe',
            trigger: 'After created a DareMe',
            dareme: updatedDareme,
        });
        return res.status(200).json({ success: true });
    } catch (err) {
        console.log(err)
    }
}

export const getDraftDareme = (req: Request, res: Response) => {
    const { userId } = req.body;
    DareMe.findOne({ owner: userId, published: false })
        .populate({ path: 'options.option' })
        .then((dareme: any) => {
            if (dareme) {
                res.status(200).json({ isDraft: true, dareme: dareme });
            } else res.status(200).json({ isDraft: false });
        }).catch((err: any) => console.log(err));
}

export const saveDareme = async (req: Request, res: Response) => {
    try {
        const { dareme, userId } = req.body;
        dareme.owner = userId;
        const resDareme = await DareMe.findOne({ owner: userId, published: false });
        if (resDareme) {
            if (resDareme.teaser && resDareme.teaser !== dareme.teaser) {
                const filePath = "public/" + resDareme.teaser;
                fs.unlink(filePath, (err) => {
                    if (err) throw err;
                });
            }
            if (resDareme.cover && resDareme.cover !== dareme.cover) {
                const filePath = "public/" + resDareme.cover;
                fs.unlink(filePath, (err) => {
                    if (err) throw err;
                });
            }
            if (resDareme.options.length && resDareme.options[0].option._id !== null) {
                await Promise.all([
                    Option.findByIdAndUpdate(resDareme.options[0].option._id, { title: dareme.options[0].option.title }),
                    Option.findByIdAndUpdate(resDareme.options[1].option._id, { title: dareme.options[1].option.title })
                ]);
            } else {
                let newOptions: Array<any> = [];
                if (dareme.options.length) {
                    const tempOption1 = new Option({
                        writer: userId,
                        title: dareme.options[0].option.title,
                        status: 1
                    });
                    const tempOption2 = new Option({
                        writer: userId,
                        title: dareme.options[1].option.title,
                        status: 1
                    });
                    const resOptions = await Promise.all([tempOption1.save(), tempOption2.save()])
                    newOptions.push({ option: resOptions[0]._id });
                    newOptions.push({ option: resOptions[1]._id });
                }
                dareme.options = newOptions;
            }
            const updatedDareme = await DareMe.findByIdAndUpdate(resDareme._id, {
                title: dareme.title,
                teaser: dareme.teaser,
                cover: dareme.cover,
                deadline: dareme.deadline,
                category: dareme.category,
                options: dareme.options,
                sizeType: dareme.sizeType,
                coverIndex: dareme.coverIndex
            }, { new: true });
            const resultDareme = await DareMe.findById(updatedDareme._id).populate({ path: 'options.option' });
            if (resultDareme) res.status(200).json({ success: true, dareme: resultDareme });
        } else {
            let newOptions: Array<any> = [];
            if (dareme.options.length) {
                const tempOption1 = new Option({
                    writer: userId,
                    title: dareme.options[0].option.title,
                    status: 1
                });
                const tempOption2 = new Option({
                    writer: userId,
                    title: dareme.options[1].option.title,
                    status: 1
                });
                const resOptions = await Promise.all([tempOption1.save(), tempOption2.save()])
                newOptions.push({ option: resOptions[0]._id });
                newOptions.push({ option: resOptions[1]._id });
            }
            dareme.options = newOptions;
            dareme.published = false;
            const newDareme = new DareMe(dareme);
            const resNewDareme = await newDareme.save();
            const resultDareme = await DareMe.findById(resNewDareme._id).populate({ path: 'options.option' });
            if (resultDareme) res.status(200).json({ success: true, dareme: resultDareme });
        }
    } catch (err: any) {
        console.log(err);
    }
}

const coverStorage = multer.diskStorage({
    destination: "./public/uploads/cover/",
    filename: function (req, file, cb) {
        cb(null, "Cover-" + Date.now() + path.extname(file.originalname));
    }
});

const uploadCover = multer({
    storage: coverStorage,
    limits: { fileSize: 30 * 1024 * 1024 },
}).single("file");

export const selectCover = (req: Request, res: Response) => {
    uploadCover(req, res, () => {
        res.status(200).json({ success: true, path: "uploads/cover/" + req.file?.filename });
    });
}

const teaserStorage = multer.diskStorage({
    destination: "./public/uploads/teaser/",
    filename: function (req, file, cb) {
        cb(null, "Teaser-" + Date.now() + path.extname(file.originalname));
    }
});

const uploadTeaser = multer({
    storage: teaserStorage,
    limits: { fileSize: 30 * 1024 * 1024 },
}).single("file");

export const uploadFile = (req: Request, res: Response) => {
    uploadTeaser(req, res, () => {
        res.status(200).json({ success: true, path: "uploads/teaser/" + req.file?.filename });
    });
}

export const checkDareMeFinished = async (req: Request, res: Response) => {
    try {
        const { daremeId } = req.params;
        const dareme = await DareMe.findById(daremeId);
        return res.status(200).json({ finished: dareme.finished });
    } catch (err) {
        console.log(err);
    }
}

export const deleteDareme = async (req: Request, res: Response) => {
    try {
        const { daremeId } = req.params;
        const dareme = await DareMe.findById(daremeId);
        if (dareme.teaser) {
            const filePath = "public/" + dareme.teaser;
            fs.unlink(filePath, (err) => {
                if (err) throw err;
            });
        }
        if (dareme.cover) {
            const filePath = "public/" + dareme.cover;
            fs.unlink(filePath, (err) => {
                if (err) throw err;
            });
        }
        await DareMe.findByIdAndDelete(daremeId);
        return res.status(200).json({ success: true });
    } catch (err) {
        console.log(err);
    }
}

export const getDaremesByPersonalUrl = async (req: Request, res: Response) => {
    try {
        const { url } = req.body;
        let results: Array<object> = [];
        const user = await User.findOne({ personalisedUrl: url }).select({ 'name': 1, 'avatar': 1, 'personalisedUrl': 1, 'categories': 1, 'subscribed_users': 1, 'tipFunction': 1 });
        const userDaremes = await DareMe.find({ owner: user._id, published: true, show: true })
            .populate({ path: 'owner', select: { 'name': 1, 'avatar': 1, 'personalisedUrl': 1, 'status': 1 } })
            .populate({ path: 'options.option', select: { 'donuts': 1, '_id': 0, 'status': 1, 'voters': 1, 'voteInfo': 1 } })
            .select({ 'published': 0, 'wallet': 0, '__v': 0 });
        const userFundmes = await FundMe.find({ owner: user._id, published: true, show: true })
            .populate({ path: 'owner', select: { 'name': 1, 'avatar': 1, 'personalisedUrl': 1, 'status': 1 } })
            .select({ 'published': 0, '__v': 0 });

        const ongoings: Array<object> = [];
        const finishes: Array<object> = [];

        userDaremes.filter((userDareme: any) => userDareme.finished === false).forEach((dareme: any) => {
            let donuts = 0;
            dareme.options.forEach((option: any) => { if (option.option.status === 1) donuts += option.option.donuts; });
            ongoings.push({
                _id: dareme._id,
                owner: dareme.owner,
                title: dareme.title,
                deadline: dareme.deadline,
                category: dareme.category,
                teaser: dareme.teaser,
                donuts: donuts,
                cover: dareme.cover,
                sizeType: dareme.sizeType,
                isUser: true,
                finished: dareme.finished,
                time: (new Date(dareme.date).getTime() - new Date(calcTime()).getTime() + 24 * 1000 * 3600 * dareme.deadline) / (24 * 3600 * 1000),
                date: dareme.date
            });
        });

        userFundmes.filter((userFundme: any) => userFundme.finished === false).forEach((fundme: any) => {
            ongoings.push({
                _id: fundme._id,
                owner: fundme.owner,
                title: fundme.title,
                deadline: fundme.deadline,
                category: fundme.category,
                teaser: fundme.teaser,
                donuts: fundme.wallet,
                goal: fundme.goal,
                cover: fundme.cover,
                sizeType: fundme.sizeType,
                isUser: true,
                finished: fundme.finished,
                time: (new Date(fundme.date).getTime() - new Date(calcTime()).getTime() + 24 * 1000 * 3600 * fundme.deadline) / (24 * 3600 * 1000),
                date: fundme.date
            });
        });

        let voterCount = 0;

        userDaremes.filter((userDareme: any) => userDareme.finished === true).forEach((dareme: any) => {
            let donuts = 0;
            dareme.options.forEach((option: any) => {
                if (option.option.status === 1)
                    donuts += option.option.donuts;
                if (option.option.voters !== 0) {
                    option.option.voteInfo.forEach((voter: any) => {
                        if (voter.donuts > 1)
                            voterCount++;
                    })
                }
            });
            finishes.push({
                _id: dareme._id,
                owner: dareme.owner,
                title: dareme.title,
                deadline: dareme.deadline,
                category: dareme.category,
                teaser: dareme.teaser,
                donuts: donuts,
                cover: dareme.cover,
                sizeType: dareme.sizeType,
                isUser: true,
                finished: dareme.finished,
                time: (new Date(dareme.date).getTime() - new Date(calcTime()).getTime() + 24 * 1000 * 3600 * dareme.deadline) / (24 * 3600 * 1000),
                date: dareme.date
            });
        });

        userFundmes.filter((userFundme: any) => userFundme.finished === true).forEach((fundme: any) => {
            if (fundme.voteInfo.length > 0) {
                fundme.voteInfo.forEach((voter: any) => {
                    if (voter.donuts > 1)
                        voterCount++;
                })
            }
            finishes.push({
                _id: fundme._id,
                owner: fundme.owner,
                title: fundme.title,
                deadline: fundme.deadline,
                category: fundme.category,
                teaser: fundme.teaser,
                donuts: fundme.wallet,
                goal: fundme.goal,
                cover: fundme.cover,
                sizeType: fundme.sizeType,
                isUser: true,
                finished: fundme.finished,
                time: (new Date(fundme.date).getTime() - new Date(calcTime()).getTime() + 24 * 1000 * 3600 * fundme.deadline) / (24 * 3600 * 1000),
                date: fundme.date
            });
        });

        ongoings.sort((first: any, second: any) => { return new Date(first.date).getTime() > new Date(second.date).getTime() ? 1 : new Date(first.date).getTime() < new Date(second.date).getTime() ? -1 : 0; });
        finishes.sort((first: any, second: any) => { return new Date(first.date).getTime() > new Date(second.date).getTime() ? 1 : new Date(first.date).getTime() < new Date(second.date).getTime() ? -1 : 0; });
        results = ongoings.concat(finishes);

        const daredDaremes = await DareMe.find({ published: true, show: true })
            .where('owner').ne(user._id)
            .populate({ path: 'owner', select: { 'name': 1, 'avatar': 1, 'personalisedUrl': 1 } })
            .populate({ path: 'options.option', select: { 'donuts': 1, '_id': 0, 'writer': 1, 'status': 1, 'voteInfo': 1 } })
            .select({ 'published': 0, 'wallet': 0, '__v': 0 });

        daredDaremes.filter((daredDareme: any) => daredDareme.finished === false).sort((first: any, second: any) => {
            return new Date(first.date).getTime() > new Date(second.date).getTime() ? 1 : new Date(first.date).getTime() < new Date(second.date).getTime() ? -1 : 0;
        }).forEach((dareme: any) => {
            var isWriter = false;
            for (let i = 0; i < dareme.options.length; i++) {
                if ((dareme.options[i].option.writer + "") === (user._id + "") && dareme.options[i].option.status === 1) {
                    isWriter = true;
                    break;
                }
                for (let j = 0; j < dareme.options[i].option.voteInfo.length; j++) {
                    if ((dareme.options[i].option.voteInfo[j].voter + "") === (user._id + "")) {
                        isWriter = true;
                        break;
                    }
                }
                if (isWriter) break;
            }
            if (isWriter === true) {
                let donuts = 0;
                dareme.options.forEach((option: any) => { if (option.option.status === 1) donuts += option.option.donuts; });
                results.push({
                    _id: dareme._id,
                    owner: dareme.owner,
                    title: dareme.title,
                    deadline: dareme.deadline,
                    category: dareme.category,
                    teaser: dareme.teaser,
                    donuts: donuts,
                    cover: dareme.cover,
                    sizeType: dareme.sizeType,
                    finished: dareme.finished,
                    isUser: false,
                    time: (new Date(dareme.date).getTime() - new Date(calcTime()).getTime() + 24 * 1000 * 3600 * dareme.deadline + 1000 * 60) / (24 * 3600 * 1000),
                    date: dareme.date
                });
            }
        });

        daredDaremes.filter((daredDareme: any) => daredDareme.finished === true).sort((first: any, second: any) => {
            return new Date(first.date).getTime() > new Date(second.date).getTime() ? 1 : new Date(first.date).getTime() < new Date(second.date).getTime() ? -1 : 0;
        }).forEach((dareme: any) => {
            var isWriter = false;
            for (let i = 0; i < dareme.options.length; i++) {
                if ((dareme.options[i].option.writer + "") === (user._id + "") && dareme.options[i].option.status === 1) {
                    isWriter = true;
                    break;
                }
                for (let j = 0; j < dareme.options[i].option.voteInfo.length; j++) {
                    if ((dareme.options[i].option.voteInfo[j].voter + "") === (user._id + "")) {
                        isWriter = true;
                        break;
                    }
                }
                if (isWriter) break;
            }
            if (isWriter === true) {
                let donuts = 0;
                dareme.options.forEach((option: any) => { if (option.option.status === 1) donuts += option.option.donuts; });
                results.push({
                    _id: dareme._id,
                    owner: dareme.owner,
                    title: dareme.title,
                    deadline: dareme.deadline,
                    category: dareme.category,
                    teaser: dareme.teaser,
                    donuts: donuts,
                    cover: dareme.cover,
                    sizeType: dareme.sizeType,
                    finished: dareme.finished,
                    isUser: false,
                    time: (new Date(dareme.date).getTime() - new Date(calcTime()).getTime() + 24 * 1000 * 3600 * dareme.deadline + 1000 * 60) / (24 * 3600 * 1000),
                    date: dareme.date
                });
            }
        });

        const fundedFundmes = await FundMe.find({ published: true, show: true })
            .where('owner').ne(user._id)
            .populate({ path: 'owner', select: { 'name': 1, 'avatar': 1, 'personalisedUrl': 1 } })

        fundedFundmes.sort((first: any, second: any) => {
            return new Date(first.date).getTime() > new Date(second.date).getTime() ? 1 : new Date(first.date).getTime() < new Date(second.date).getTime() ? -1 : 0;
        }).forEach((fundme: any) => {
            let isWritter = false;
            for (let i = 0; i < fundme.voteInfo.length; i++) {
                if (fundme.voteInfo[i].voter + "" === user._id + "") {
                    isWritter = true;
                    break;
                }
            }
            if (isWritter) {
                let donuts = 0;
                fundme.voteInfo.forEach((voter: any) => {
                    donuts += voter.donuts;
                })
                results.push({
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
                    isUser: false,
                    goal: fundme.goal,
                    time: (new Date(fundme.date).getTime() - new Date(calcTime()).getTime() + 24 * 1000 * 3600 * fundme.deadline + 1000 * 60) / (24 * 3600 * 1000),
                    date: fundme.date
                })
            }
        })

        return res.status(200).json({ daremes: results, user: user, voterCount: voterCount });
    } catch (err) {
        console.log(err);
    }
}

export const getDaremesOngoing = async (req: Request, res: Response) => {
    try {
        const daremeFunc = DareMe.find({ published: true, show: true })
            .populate({ path: 'owner', select: { 'avatar': 1, 'personalisedUrl': 1, 'name': 1 } })
            .populate({ path: 'options.option', select: { 'donuts': 1, '_id': 0, 'status': 1 } })
            .select({ 'published': 0, 'wallet': 0, '__v': 0 });
        const fundmeFunc = FundMe.find({ published: true, show: true })
            .populate({ path: 'owner', select: { 'avatar': 1, 'personalisedUrl': 1, 'name': 1 } })
            .select({ 'published': 0, '__v': 0 });
        const fanwallFunc = Fanwall.find({ posted: true })
            .populate({ path: 'writer', select: { 'avatar': 1, 'personalisedUrl': 1, 'name': 1 } })
            .populate([
                {
                    path: 'dareme',
                    Model: DareMe,
                    select: {
                        'title': 1, 'deadline': 1, 'category': 1
                    },
                    populate: {
                        path: 'options.option',
                        model: Option
                    }
                },
                {
                    path: 'fundme',
                    Model: FundMe,
                    select: {
                        'title': 1, 'deadline': 1, 'category': 1, 'goal': 1, 'wallet': 1, 'voteInfo': 1, 'reward': 1
                    }
                }
            ]);

        const result = await Promise.all([daremeFunc, fundmeFunc, fanwallFunc]);
        const daremes = result[0];
        const fundmes = result[1];
        const fanwalls = result[2];

        let resItems = <Array<any>>[];
        for (const dareme of daremes) {
            let donuts = 0;
            let fanwall = await Fanwall.findOne({ dareme: dareme._id });
            dareme.options.forEach((option: any) => { if (option.option.status === 1) donuts += option.option.donuts; });
            resItems.push({
                id: dareme._id,
                type: 'dareme',
                owner: dareme.owner,
                title: dareme.title,
                deadline: dareme.deadline,
                category: dareme.category,
                teaser: dareme.teaser,
                donuts: donuts,
                finished: dareme.finished,
                sizeType: dareme.sizeType,
                cover: dareme.cover,
                date: dareme.date,
                fanwall: fanwall ? fanwall.posted : false,
                time: (new Date(dareme.date).getTime() - new Date(calcTime()).getTime() + 24 * 1000 * 3600 * dareme.deadline) / (24 * 3600 * 1000),
            });
        }

        for (const fundme of fundmes) {
            let fanwall = await Fanwall.findOne({ fundme: fundme._id });
            resItems.push({
                id: fundme._id,
                type: 'fundme',
                goal: fundme.goal,
                owner: fundme.owner,
                title: fundme.title,
                deadline: fundme.deadline,
                category: fundme.category,
                teaser: fundme.teaser,
                donuts: fundme.wallet,
                finished: fundme.finished,
                sizeType: fundme.sizeType,
                cover: fundme.cover,
                date: fundme.date,
                fanwall: fanwall ? fanwall.posted : false,
                time: (new Date(fundme.date).getTime() - new Date(calcTime()).getTime() + 24 * 1000 * 3600 * fundme.deadline) / (24 * 3600 * 1000),
            });
        }

        let resFanwalls = <Array<any>>[];
        fanwalls.sort((first: any, second: any) => {
            return first.date < second.date ? 1 : first.date > second.date ? -1 : 0;
        }).forEach((fanwall: any) => {
            let totalDonuts = 0;
            if (fanwall.dareme) {
                fanwall.dareme.options.forEach((option: any) => { if (option.option.status === 1) totalDonuts += option.option.donuts; });
                resFanwalls.push({
                    id: fanwall._id,
                    date: fanwall.date,
                    writer: fanwall.writer,
                    video: fanwall.video,
                    sizeType: fanwall.sizeType,
                    cover: fanwall.cover,
                    message: fanwall.message,
                    embedUrl: fanwall.embedUrl,
                    unlocks: fanwall.unlocks,
                    dareme: {
                        title: fanwall.dareme.title,
                        options: fanwall.dareme.options,
                        category: fanwall.dareme.category,
                        donuts: totalDonuts
                    }
                });
            } else {
                resFanwalls.push({
                    id: fanwall._id,
                    date: fanwall.date,
                    writer: fanwall.writer,
                    video: fanwall.video,
                    sizeType: fanwall.sizeType,
                    cover: fanwall.cover,
                    message: fanwall.message,
                    embedUrl: fanwall.embedUrl,
                    unlocks: fanwall.unlocks,
                    dareme: {
                        goal: fanwall.fundme.goal,
                        title: fanwall.fundme.title,
                        category: fanwall.fundme.category,
                        donuts: fanwall.fundme.wallet,
                        options: null,
                        voteInfo: fanwall.fundme.voteInfo,
                        reward: fanwall.fundme.reward
                    }
                });
            }
        });

        return res.status(200).json({ daremes: resItems, fanwalls: resFanwalls });
    } catch (err) {
        console.log(err);
    }
}

export const getDaremeDetails = async (req: Request, res: Response) => {
    try {
        const { daremeId } = req.params;
        const dareme = await DareMe.findById(daremeId)
            .populate({ path: 'owner', select: { 'avatar': 1, 'personalisedUrl': 1, 'name': 1, '_id': 1 } })
            .populate({
                path: 'options.option',
                model: Option,
                populate: { path: 'writer', select: { '_id': 0, 'name': 1 } },
                select: { '__v': 0, 'win': 0 },
            }).select({ 'published': 0, 'wallet': 0, '__v': 0 });
        if (dareme) {
            let donuts = 0;
            dareme.options.forEach((option: any) => { if (option.option.status === 1) donuts += option.option.donuts; });
            const result = {
                _id: dareme._id,
                owner: dareme.owner,
                title: dareme.title,
                deadline: dareme.deadline,
                category: dareme.category,
                teaser: dareme.teaser,
                donuts: donuts,
                cover: dareme.cover,
                sizeType: dareme.sizeType,
                options: dareme.options,
                finished: dareme.finished,
                show: dareme.show,
                time: (new Date(dareme.date).getTime() - new Date(calcTime()).getTime() + 24 * 1000 * 3600 * dareme.deadline + 1000 * 60) / (24 * 3600 * 1000),
            };
            return res.status(200).json({ success: true, dareme: result });
        }
    } catch (err) {
        console.log(err);
    }
}

export const getDaremeResult = async (req: Request, res: Response) => {
    try {
        const { daremeId } = req.params;
        const dareme = await DareMe.findById(daremeId)
            .populate({ path: 'owner', select: { 'avatar': 1, 'personalisedUrl': 1, 'name': 1, '_id': 1 } })
            .populate({
                path: 'options.option',
                model: Option,
                populate: { path: 'writer', select: { '_id': 0, 'name': 1 } },
                select: { '__v': 0 },
            }).select({ 'finished': 0, 'published': 0, 'wallet': 0, '__v': 0 });
        if (dareme) {
            const fanwall = await Fanwall.findOne({ dareme: dareme._id }).select({ '__v': 0, 'data': 0 });
            const options = dareme.options.filter((option: any) => option.option.status === 1);
            dareme.options = options;
            let donuts = 0;
            dareme.options.forEach((option: any) => { if (option.option.status === 1) donuts += option.option.donuts; });
            const result = {
                _id: dareme._id,
                owner: dareme.owner,
                title: dareme.title,
                deadline: dareme.deadline,
                category: dareme.category,
                teaser: dareme.teaser,
                donuts: donuts,
                cover: dareme.cover,
                sizeType: dareme.sizeType,
                options: dareme.options,
                finished: dareme.finished,
                time: (new Date(dareme.date).getTime() - new Date(calcTime()).getTime() + 24 * 1000 * 3600 * dareme.deadline + 1000 * 60) / (24 * 3600 * 1000),
            };
            return res.status(200).json({ success: true, dareme: result, fanwall: fanwall });
        }
    } catch (err) {
        console.log(err);
    }
}

export const getOptionsFromUserId = async (req: Request, res: Response) => {
    try {

    } catch (e) {
        console.log(e);
    }
}

export const getOptionDetails = async (req: Request, res: Response) => {
    try {
        const { optionId, daremeId } = req.params;
        const dareme = await DareMe.findById(daremeId)
            .populate({ path: 'owner', select: { 'avatar': 1, 'personalisedUrl': 1, 'name': 1 } })
            .populate({ path: 'options.option' })
            .select({ 'teaser': 1, 'options': 1, 'title': 1, 'cover': 1, 'sizeType': 1 });
        const resDareme = {
            _id: dareme._id,
            owner: dareme.owner,
            teaser: dareme.teaser,
            title: dareme.title,
            cover: dareme.cover,
            sizeType: dareme.sizeType,
            options: dareme.options
        };
        const option = await Option.findById(optionId)
            .select({ 'donuts': 1, 'title': 1 })
            .populate({ path: 'writer', select: { 'avatar': 1, 'personalisedUrl': 1, 'name': 1, '_id': 0 } });
        if (option) res.status(200).json({ option: option, dareme: resDareme, success: true });
    } catch (err) {
        console.log(err);
    }
}

export const supportCreator = async (req: Request, res: Response) => {
    try {
        const { userId, daremeId, optionId, amount } = req.body;
        const option = await Option.findById(optionId);
        let voteInfo = option.voteInfo;
        let totalDonuts = option.donuts + amount;
        let totalVoters = option.voters;
        let filters = voteInfo.filter((option: any) => (option.voter + "") === (userId + ""));
        if (filters.length) {
            voteInfo = voteInfo.map((option: any) => {
                if ((option.voter + "") === (userId + "")) {
                    if (amount === 50) option.donuts = option.donuts + 50;
                    else option.canFree = false;
                }
                return option;
            });
        } else {
            totalVoters = totalVoters + 1;
            voteInfo.push({ voter: userId, donuts: amount > 1 ? amount : 0, canFree: amount === 1 ? false : true });
        }
        const optionNew = await Option.findByIdAndUpdate(option._id, { donuts: totalDonuts, voters: totalVoters, voteInfo: voteInfo }, { new: true })
            .select({ 'donuts': 1, 'title': 1 })
            .populate({ path: 'writer', select: { 'avatar': 1, 'personalisedUrl': 1, 'name': 1, '_id': 0 } });

        const dareme = await DareMe.findById(daremeId).populate({ path: 'owner' });
        const daremeWallet = dareme.wallet + amount;
        const updatedDareme = await DareMe.findByIdAndUpdate(daremeId, { wallet: daremeWallet }, { new: true })
            .populate({ path: 'owner', select: { 'avatar': 1, 'personalisedUrl': 1, 'name': 1 } })
            .populate({ path: 'options.option' })
            .select({ 'teaser': 1, 'options': 1, 'title': 1, 'cover': 1, 'sizeType': 1 });
        const resDareme = {
            _id: updatedDareme._id,
            owner: updatedDareme.owner,
            teaser: updatedDareme.teaser,
            title: updatedDareme.title,
            cover: updatedDareme.cover,
            sizeType: updatedDareme.sizeType,
            options: updatedDareme.options
        };
        const user = await User.findById(userId);

        if (amount === 1) {
            const adminWallet = await AdminWallet.findOne({ admin: "ADMIN" });
            const adminDonuts = adminWallet.wallet - 1;
            await AdminWallet.findOneAndUpdate({ admin: "ADMIN" }, { wallet: adminDonuts });
            req.body.io.to("ADMIN").emit("wallet_change", adminDonuts);
            const transaction = new AdminUserTransaction({
                description: 3,
                from: "ADMIN",
                to: "DAREME",
                user: userId,
                dareme: daremeId,
                donuts: 1,
                date: calcTime()
            });
            await transaction.save();

            addNewNotification(req.body.io, {
                section: 'Ongoing DareMe',
                trigger: 'After voter voted in DareMe (non-Superfans)',
                dareme: updatedDareme,
                option: option,
                voterId: userId
            });
            return res.status(200).json({ success: true, dareme: resDareme, option: optionNew });
        }

        if (amount === 50) {
            let wallet = user.wallet - 50;
            const updatedUser = await User.findByIdAndUpdate(userId, { wallet: wallet }, { new: true });
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
            req.body.io.to(updatedUser.email).emit("wallet_change", updatedUser.wallet);
            const transaction = new AdminUserTransaction({
                description: 5,
                from: "USER",
                to: "DAREME",
                user: userId,
                dareme: daremeId,
                donuts: 50,
                date: calcTime()
            });
            await transaction.save();

            addNewNotification(req.body.io, {
                section: 'Ongoing DareMe',
                trigger: 'After voter voted in DareMe (Superfans)',
                dareme: updatedDareme,
                option: option,
                voterId: userId
            });
            return res.status(200).json({ success: true, dareme: resDareme, option: optionNew, user: payload });
        }

        //create notification
        // let new_notification = new Notification({
        //     sender: userId,
        //     receivers: [dareme.owner],
        //     message: `<strong>"${user.name}"</strong> supported <strong>"${option.title}"</strong> with ${amount} Donuts.`,
        //     them: "new vote",
        //     type: "ongoing_dareme",
        //     dareme: dareme._id,
        // });
        // await new_notification.save();
        // req.body.io.to(dareme.owner.email).emit("create_notification");
        //end
    } catch (err) {
        console.log(err);
    }
}

export const getDareCreatorDetails = async (req: Request, res: Response) => {
    try {
        const { daremeId } = req.params;
        const dareme = await DareMe.findById(daremeId).populate({ path: 'owner', select: { 'avatar': 1, 'name': 1, 'personalisedUrl': 1 } }).select({ 'title': 1, 'teaser': 1, 'cover': 1, 'sizeType': 1 });
        return res.status(200).json({ success: true, dareme: dareme });
    } catch (err) {
        console.log(err);
    }
}

export const dareCreator = async (req: Request, res: Response) => {
    const { daremeId, title, amount, userId } = req.body; //get params : userId=session,daremeId:
    const newOption = new Option({
        title: title,
        writer: userId,
        status: 0,
        donuts: amount,
        voters: 1,
        voteInfo: [{
            voter: userId,
            donuts: amount
        }]
    });

    const option = await newOption.save();
    const user = await User.findById(userId); // sender who is called this api
    const dareme = await DareMe.findById(daremeId).populate({ path: 'owner' });

    let daremeWallet = dareme.wallet + amount;
    let options = dareme.options;
    options.push({ option: option._id });

    await DareMe.findByIdAndUpdate(dareme._id, { options: options, wallet: daremeWallet }, { new: true });

    let wallet = user.wallet - amount;

    const updatedUser = await User.findByIdAndUpdate(user._id, { wallet: wallet }, { new: true });

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

    req.body.io.to(updatedUser.email).emit("wallet_change", updatedUser.wallet);

    const transaction = new AdminUserTransaction({
        description: 6,
        from: "USER",
        to: "DAREME",
        user: userId,
        dareme: daremeId,
        donuts: amount,
        date: calcTime()
    });

    await transaction.save();

    return res.status(200).json({ success: true, option: option, user: payload });
}

export const checkDareMeRequests = async (req: Request, res: Response) => {
    const { daremeId } = req.params;
    const dareme = await DareMe.findById(daremeId);
    const options = dareme.options.filter((option: any) => option.option.status !== 1);
    return res.status(200).json({ request: options.length > 0 ? true : false });
}

export const getDareMeRequests = async (req: Request, res: Response) => {
    const { daremeId } = req.params;
    const dareme = await DareMe.findById(daremeId)
        .populate({ path: 'owner', select: { 'avatar': 1, 'personalisedUrl': 1, 'name': 1 } })
        .populate({
            path: 'options.option',
            model: Option,
            populate: { path: 'writer' }
        }).select({ 'teaser': 1, 'options': 1, 'title': 1, 'date': 1, 'deadline': 1, 'cover': 1, 'sizeType': 1 });
    const options = dareme.options.filter((option: any) => option.option.status !== 1)
        .sort((first: any, second: any) =>
            first.option.status > second.option.status ? -1 :
                first.option.status < second.option.status ? 1 :
                    first.option.date > second.option.date ? 1 :
                        first.option.date < second.option.date ? -1 : 0);;
    dareme.options = options;
    let donuts = 0;
    dareme.options.forEach((option: any) => { if (option.option.status === 1) donuts += option.option.donuts; });
    const result = {
        _id: dareme._id,
        owner: dareme.owner,
        title: dareme.title,
        deadline: dareme.deadline,
        category: dareme.category,
        teaser: dareme.teaser,
        donuts: donuts,
        cover: dareme.cover,
        sizeType: dareme.sizeType,
        options: dareme.options,
        finished: dareme.finished,
        time: (new Date(dareme.date).getTime() - new Date(calcTime()).getTime() + 24 * 1000 * 3600 * dareme.deadline + 1000 * 60) / (24 * 3600 * 1000),
    };
    return res.status(200).json({ success: true, dareme: result });
}

export const acceptDareOption = (req: Request, res: Response) => {
    const { optionId } = req.body;
    Option.findByIdAndUpdate(optionId, { status: 1 }, { new: true })
        .then((option: any) => {
            if (option) return res.status(200).json({ success: true });
        }).catch((err: any) => console.log(err));
}

export const declineDareOption = async (req: Request, res: Response) => {
    try {
        const { optionId, daremeId } = req.body;
        const option = await Option.findByIdAndUpdate(optionId, { status: -1 }, { new: true }).populate({ path: 'writer' });
        const user = await User.findById(option.writer._id);
        await User.findByIdAndUpdate(option.writer._id, { wallet: user.wallet + option.donuts });
        const dareme = await DareMe.findById(daremeId);
        await DareMe.findByIdAndUpdate(daremeId, { wallet: dareme.wallet - option.donuts });
        req.body.io.to(option.writer.email).emit("wallet_change", user.wallet + option.donuts);
        const transaction = new AdminUserTransaction({
            description: 7,
            from: "DAREME",
            to: "USER",
            user: user._id,
            dareme: daremeId,
            donuts: option.donuts,
            date: calcTime()
        });
        await transaction.save();
        return res.status(200).json({ success: true });
    } catch (err) {
        console.log(err);
    }
}

export const winDareOption = async (req: Request, res: Response) => {
    try {
        const { optionId, daremeId } = req.body;
        await Option.findByIdAndUpdate(optionId, { win: true });
        const dareme = await DareMe.findById(daremeId).populate({ path: 'options.option', model: Option });
        const options = dareme.options;
        const filters = options.filter((option: any) => option.option.win === false);
        let minusDonuts = 0;
        for (const option of filters) {
            for (const vote of option.option.voteInfo) {
                if ((option.option.writer + "") !== (vote.voter + "")) {
                    const voter = await User.findById(vote.voter);
                    let wallet = voter.wallet + vote.donuts;
                    await User.findByIdAndUpdate(vote.voter, { wallet: wallet });
                    req.body.io.to(voter.email).emit("wallet_change", wallet);
                    const transaction = new AdminUserTransaction({
                        description: 7,
                        from: "DAREME",
                        to: "USER",
                        user: vote.voter,
                        dareme: daremeId,
                        donuts: vote.donuts,
                        date: calcTime()
                    });
                    await transaction.save();
                    minusDonuts += vote.donuts;
                }
            }
        }
        await DareMe.findByIdAndUpdate(daremeId, { wallet: dareme.wallet - minusDonuts });
        return res.status(200).json({ success: true });
    } catch (err) {
        console.log(err);
    }
}

export const getDareMeList = async (req: Request, res: Response) => {
    try {
        const { search } = req.body;
        if (search === "") {
            const daremes = await DareMe.find({ 'published': true })
                .populate({ path: 'owner', select: { 'name': 1, 'categories': 1 } })
                .select({ 'title': 1, 'category': 1, 'date': 1, 'deadline': 1, 'finished': 1, 'owner': 1, 'show': 1, 'wallet': 1 });
            var result: Array<object> = [];
            for (const dareme of daremes) {
                let time = 0.0;
                if (!dareme.finished) time = (new Date(dareme.date).getTime() - new Date(calcTime()).getTime() + 3600 * 24 * dareme.deadline * 1000) / (1000 * 24 * 3600);
                result.push({
                    id: dareme._id,
                    date: dareme.date,
                    time: time,
                    finished: dareme.finished,
                    owner: dareme.owner,
                    category: dareme.category,
                    title: dareme.title,
                    wallet: dareme.wallet,
                    show: dareme.show
                });
            }
            return res.status(200).json({ success: true, daremes: result });
        }
    } catch (err) {
        console.log(err);
    }
}

export const setDareMeShow = async (req: Request, res: Response) => {
    try {
        const { daremeId } = req.params;
        const { show } = req.body;
        const updatedDareme = await DareMe.findByIdAndUpdate(daremeId, { show: show }, { new: true });
        if (updatedDareme) return res.status(200).json({ success: true });
    } catch (err) {
        console.log(err);
    }
}

export const deleteDareMe = async (req: Request, res: Response) => {
    try {
        const { daremeId } = req.params;
        const dareme = await DareMe.findById(daremeId);
        const options = dareme.options;
        for (const option of options) {
            await Option.findByIdAndDelete(option.option);
        }
        if (dareme.teaser) {
            const filePath = "public/" + dareme.teaser;
            fs.unlink(filePath, (err) => {
                if (err) throw err;
            });
        }
        if (dareme.cover) {
            const filePath = "public/" + dareme.cover;
            fs.unlink(filePath, (err) => {
                if (err) throw err;
            });
        }
        await DareMe.findByIdAndDelete(daremeId);
        return res.status(200).json({ success: true });
    } catch (err) {
        console.log(err);
    }
}

export const updateDareMe = async (req: Request, res: Response) => {
    try {
        const { daremeId } = req.params;
        const { dareme } = req.body;
        const resDareme = await DareMe.findById(daremeId);
        if (dareme.teaserFile) {
            const filePath = "public/" + resDareme.teaser;
            fs.unlink(filePath, (err) => {
                if (err) throw err;
            });
        }
        if (dareme.coverFile && resDareme.cover) {
            const filePath = "public/" + resDareme.cover;
            fs.unlink(filePath, (err) => {
                if (err) throw err;
            });
        }
        if (dareme.options) {
            await Option.findByIdAndUpdate(dareme.options[0].option._id, { title: dareme.options[0].option.title });
            await Option.findByIdAndUpdate(dareme.options[1].option._id, { title: dareme.options[1].option.title });
        }
        await DareMe.findByIdAndUpdate(daremeId, {
            title: dareme.title,
            category: dareme.category,
            teaser: dareme.teaserFile ? dareme.teaserFile : resDareme.teaser,
            cover: dareme.coverFile ? dareme.coverFile : resDareme.cover,
            sizeType: dareme.teaserType !== null ? dareme.teaserType : resDareme.sizeType
        });
        return res.status(200).json({ success: true });
    } catch (err) {
        console.log(err);
    }
}

export const deleteOption = async (req: Request, res: Response) => {
    try {
        const { daremeId, optionId } = req.params;
        await Option.findByIdAndDelete(optionId);
        const dareme = await DareMe.findById(daremeId);
        const options = dareme.options.filter((option: any) => (option.option + "") !== (optionId + ""));
        await DareMe.findByIdAndUpdate(daremeId, { options: options });
        const resDareme = await DareMe.findById(daremeId)
            .populate({ path: 'owner', select: { 'avatar': 1, 'personalisedUrl': 1, 'name': 1, '_id': 1 } })
            .populate({
                path: 'options.option',
                model: Option,
                populate: { path: 'writer', select: { '_id': 0, 'name': 1 } },
                select: { '__v': 0, 'win': 0 },
            }).select({ 'published': 0, 'wallet': 0, '__v': 0 });
        return res.status(200).json({ success: true, dareme: resDareme });
    } catch (err) {
        console.log(err);
    }
}

export const getDaremeOptions = async (req: Request, res: Response) => {
    try {
        const { daremeId } = req.params;
        const dareme = await DareMe.findById(daremeId)
            .populate({
                path: 'options.option',
                model: Option,
                populate: [
                    { path: 'writer', select: { '_id': 0, 'name': 1 } },
                    { path: 'voteInfo.voter', select: { '_id': 0, 'name': 1, 'avatar': 1 } }
                ]
            });
        const options = dareme.options;
        return res.status(200).json({ success: true, options: options });
    } catch (err) {
        console.log(err);
    }
}