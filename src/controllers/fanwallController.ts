import { Request, Response } from 'express';
import path from "path";
import multer from "multer";
import fs from "fs";
import Fanwall from "../models/Fanwall";
import DareMe from "../models/DareMe";
import FundMe from "../models/FundMe";
import Option from "../models/Option";
import User from "../models/User";
import Tip from "../models/Tip";
import AdminWallet from "../models/AdminWallet";
import AdminUserTransaction from '../models/AdminUserTransaction';

function calcTime() {
  var d = new Date();
  var utc = d.getTime();
  var nd = new Date(utc + (3600000 * 8));
  return nd;
}

/////////////////////// FANWALL //////////////////////////////////

export const getFanwallList = async (req: Request, res: Response) => {
  try {
    const result = await Promise.all([
      DareMe.find({ finished: true }).populate({ path: 'owner' }),
      FundMe.find({ finished: true }).populate({ path: 'owner' })
    ])

    const daremes = result[0]
    const fundmes = result[1]
    let daremeFuncs = <Array<any>>[]
    let fundmeFuncs = <Array<any>>[]

    for (const dareme of daremes) { daremeFuncs.push(Fanwall.findOne({ dareme: dareme._id })) }
    for (const fundme of fundmes) { fundmeFuncs.push(Fanwall.findOne({ fundme: fundme._id })) }
    const result1 = await Promise.all(daremeFuncs)
    const result2 = await Promise.all(fundmeFuncs)
    let fanwalls: Array<any> = []

    let index = 0
    for (const dareme of daremes) {
      const fanwall = result1[index]
      fanwalls.push({
        itemId: dareme._id,
        owner: dareme.owner,
        fanwall: (fanwall && fanwall.posted) ? fanwall : null,
        title: dareme.title,
        category: dareme.category,
        date: dareme.date,
        type: 'DareMe'
      })
      index++
    }

    index = 0
    for (const fundme of fundmes) {
      const fanwall = result2[index]
      fanwalls.push({
        itemId: fundme._id,
        owner: fundme.owner,
        fanwall: (fanwall && fanwall.posted) ? fanwall : null,
        title: fundme.title,
        category: fundme.category,
        date: fundme.date,
        type: 'FundMe'
      })
      index++
    }

    fanwalls = fanwalls.sort((first: any, second: any) => {
      if (first.date > second.date) return 1
      else if (first.date < second.date) return -1
      else return 0
    })

    return res.status(200).json({ success: true, fanwalls: fanwalls })
  } catch (err) {
    console.log(err)
  }
}


/////////////////////////////////////////////////////////////////

export const saveFanwall = async (req: Request, res: Response) => {
  try {
    const { fanwallId, itemId, video, message, posted, embedUrl, cover, sizeType, type } = req.body
    if (type === 'dareme') {
      const dareme = await DareMe.findById(itemId)
      if (fanwallId) {
        const fanwall = await Fanwall.findById(fanwallId);
        if (fanwall.video && fanwall.video !== video) {
          const filePath = "public/" + fanwall.video;
          if (fs.existsSync(filePath)) {
            fs.unlink(filePath, (err) => {
              if (err) throw err;
            });
          }
        }
        if (fanwall.cover && fanwall.cover !== cover) {
          const filePath = "public/" + fanwall.cover;
          if (fs.existsSync(filePath)) {
            fs.unlink(filePath, (err) => {
              if (err) throw err;
            });
          }
        }

        await Fanwall.findByIdAndUpdate(fanwallId, {
          writer: dareme.owner,
          dareme: itemId,
          video: video,
          sizeType: sizeType,
          cover: cover,
          message: message,
          embedUrl: embedUrl,
          posted: posted,
          date: calcTime()
        })
      } else {
        const newFanwall = new Fanwall({
          writer: dareme.owner,
          dareme: itemId,
          video: video,
          sizeType: sizeType,
          cover: cover,
          message: message,
          embedUrl: embedUrl,
          posted: posted,
          date: calcTime()
        });
        await newFanwall.save();
      }

      if (posted) {
        const dareme = await DareMe.findById(itemId).populate({ path: 'writer' });
        if (dareme && dareme.wallet > 0) {
          const result = await Promise.all([
            User.findById(dareme.owner),
            AdminWallet.findOne({ admin: "ADMIN" })
          ])

          const user = result[0]
          const adminWallet = result[1]

          req.body.io.to(user.email).emit("wallet_change", user.wallet + dareme.wallet * 0.9)
          req.body.io.to("ADMIN").emit("wallet_change", adminWallet.wallet + dareme.wallet * 0.1)

          const transactionAdmin = new AdminUserTransaction({
            description: 4,
            from: "DAREME",
            to: "ADMIN",
            dareme: dareme._id,
            user: dareme.owner,
            donuts: dareme.wallet * 0.1,
            date: calcTime()
          });

          const transactionUser = new AdminUserTransaction({
            description: 4,
            from: "DAREME",
            to: "USER",
            user: dareme.owner,
            dareme: dareme._id,
            donuts: dareme.wallet * 0.9,
            date: calcTime()
          })

          await Promise.all([
            User.findByIdAndUpdate(dareme.owner, { wallet: user.wallet + dareme.wallet * 0.9 }),
            AdminWallet.findOneAndUpdate({ admin: "ADMIN" }, { wallet: adminWallet.wallet + dareme.wallet * 0.1 }),
            transactionAdmin.save(),
            transactionUser.save(),
            DareMe.findByIdAndUpdate(itemId, { wallet: 0 })
          ])
        }
      }
      return res.status(200).json({ success: true })

    } else if (type === 'fundme') {
      const fundme = await FundMe.findById(itemId)
      if (fanwallId) {
        const fanwall = await Fanwall.findById(fanwallId);
        if (fanwall.video && fanwall.video !== video) {
          const filePath = "public/" + fanwall.video;
          if (fs.existsSync(filePath)) {
            fs.unlink(filePath, (err) => {
              if (err) throw err;
            });
          }
        }
        if (fanwall.cover && fanwall.cover !== cover) {
          const filePath = "public/" + fanwall.cover;
          if (fs.existsSync(filePath)) {
            fs.unlink(filePath, (err) => {
              if (err) throw err;
            });
          }
        }

        await Fanwall.findByIdAndUpdate(fanwallId, {
          writer: fundme.owner,
          fundme: itemId,
          video: video,
          sizeType: sizeType,
          cover: cover,
          message: message,
          embedUrl: embedUrl,
          posted: posted,
          date: new Date(calcTime()).getTime()
        })
      } else {
        const newFanwall = new Fanwall({
          writer: fundme.owner,
          fundme: itemId,
          video: video,
          sizeType: sizeType,
          cover: cover,
          message: message,
          embedUrl: embedUrl,
          posted: posted,
          date: new Date(calcTime()).getTime()
        });
        await newFanwall.save();
      }

      if (posted) {
        const fundme = await FundMe.findById(itemId).populate({ path: 'writer' });
        if (fundme && fundme.empty === false) {
          const result = await Promise.all([
            User.findById(fundme.owner),
            AdminWallet.findOne({ admin: "ADMIN" })
          ])

          const user = result[0]
          const adminWallet = result[1]

          req.body.io.to(user.email).emit("wallet_change", user.wallet + fundme.wallet * 0.9);
          req.body.io.to("ADMIN").emit("wallet_change", adminWallet.wallet + fundme.wallet * 0.1);

          const transactionAdmin = new AdminUserTransaction({
            description: 4,
            from: "FUNDME",
            to: "ADMIN",
            fundme: fundme._id,
            donuts: fundme.wallet * 0.1,
            date: calcTime()
          })

          const transactionUser = new AdminUserTransaction({
            description: 4,
            from: "FUNDME",
            to: "USER",
            user: fundme.owner,
            fundme: fundme._id,
            donuts: fundme.wallet * 0.9,
            date: calcTime()
          })

          await Promise.all([
            User.findByIdAndUpdate(fundme.owner, { wallet: user.wallet + fundme.wallet * 0.9 }),
            AdminWallet.findOneAndUpdate({ admin: "ADMIN" }, { wallet: adminWallet.wallet + fundme.wallet * 0.1 }),
            FundMe.findByIdAndUpdate(itemId, { empty: true }),
            transactionAdmin.save(),
            transactionUser.save()
          ])
        }
      }
      return res.status(200).json({ success: true })
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
      .populate([{ path: 'owner', select: { 'avatar': 1, 'name': 1, 'personalisedUrl': 1 } }, { path: 'voteInfo.voter', select: { '_id': 0, 'name': 1, 'avatar': 1 } }]);
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
      .populate([
        {
          path: 'dareme',
          Model: DareMe,
          populate: [
            {
              path: 'options.option',
              model: Option
            },
            {
              path: 'owner',
              model: User
            }
          ]
        },
        {
          path: 'fundme',
          Model: FundMe,
          populate: [
            {
              path: 'owner',
              model: User
            }
          ]
        }
      ]);
    if (fanwall.dareme) {
      const winOption = fanwall.dareme.options.filter((option: any) => option.option.win === true)[0].option;
      const option = await Option.findById(winOption._id).populate({ path: 'writer', select: { 'name': 1 } }); // This is winoption object

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
        superfan: boolean,
        personalisedUrl: string
      }[] = [];

      options.forEach((option: any) => {
        option.option.voteInfo.forEach((vote: any) => {
          let filters = voteInfo.filter((voteinfo: any) => (voteinfo.id + "" === vote.voter._id + ""));
          if (filters.length) {
            let foundIndex = voteInfo.findIndex(voteIn => (voteIn.id + "" === filters[0].id + ""));
            let item = {
              id: filters[0].id,
              donuts: filters[0].donuts + vote.donuts,
              name: vote.voter.name,
              avatar: vote.voter.avatar,
              superfan: vote.superfan,
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
              superfan: vote.superfan,
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
        topFuns: voteInfo.slice(0, 3),
      });
    } else {
      let voteInfo: {
        id: any,
        name: string,
        donuts: number,
        date: Date,
        avatar: string,
        superfan: boolean,
        personalisedUrl: string
      }[] = [];

      const fundme = await FundMe.findById(fanwall.fundme._id)
        .populate({
          path: 'voteInfo.voter',
          Model: User
        });

      fundme.voteInfo.forEach((vote: any) => {
        voteInfo.push({
          id: vote.voter._id,
          donuts: vote.donuts + vote.canFree ? 0 : 1,
          name: vote.voter.name,
          avatar: vote.voter.avatar,
          date: vote.date,
          superfan: vote.superfan,
          personalisedUrl: vote.voter.personalisedUrl
        });
      });

      voteInfo.sort((first: any, second: any) => { return first.donuts < second.donuts ? 1 : first.donuts > second.donuts ? -1 : 0 });

      return res.status(200).json({
        success: true,
        fanwall: fanwall,
        topFuns: voteInfo.slice(0, 3),
      })
    }
  } catch (err) {
    console.log(err);
  }
}

export const getFanwallsByPersonalUrl = async (req: Request, res: Response) => {
  try {
    const { url } = req.body;
    let resFanwalls = <Array<any>>[];
    const user = await User.findOne({ personalisedUrl: url }).select({ 'name': 1, 'avatar': 1, 'personalisedUrl': 1, 'categories': 1, 'subscribed_users': 1, 'tipFunction': 1 });
    const rewardFanwalls = await Fanwall.find({ posted: true }).where('owner').ne(user._id)
      .populate({ path: 'writer', select: { 'avatar': 1, 'name': 1, 'personalisedUrl': 1 } })
      .populate([
        {
          path: 'dareme',
          Model: DareMe,
          populate: [
            {
              path: 'options.option',
              model: Option
            },
            {
              path: 'owner',
              model: User
            }
          ]
        },
        {
          path: 'fundme',
          Model: FundMe,
          populate: [
            {
              path: 'owner',
              model: User
            }
          ]
        }]
      );
    rewardFanwalls.forEach((fanwall: any) => {
      if (fanwall.dareme) {
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
      } else {
        let isVoted = false;
        for (let i = 0; i < fanwall.fundme.voteInfo.length; i++) {
          const voteInfo = fanwall.fundme.voteInfo[i];
          if ((voteInfo.voter + "" === user.id + "") && voteInfo.donuts >= 50) {
            isVoted = true;
            break;
          }
        }
        if (isVoted) {
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
              goal: fanwall.fundme.goal,
              title: fanwall.fundme.title,
              category: fanwall.fundme.category,
              donuts: fanwall.fundme.wallet,
              options: null,
              voteInfo: fanwall.fundme.voteInfo,
              reward: fanwall.fundme.reward
            },
            userFanwall: false
          });
        }
      }
    });

    const fanwalls = await Fanwall.find({ writer: user._id, posted: true })
      .populate({ path: 'writer', select: { 'avatar': 1, 'name': 1, 'personalisedUrl': 1 } })
      .populate([
        {
          path: 'dareme',
          Model: DareMe,
          populate: [
            {
              path: 'options.option',
              model: Option
            },
            {
              path: 'owner',
              model: User
            }
          ]
        },
        {
          path: 'fundme',
          Model: FundMe,
          populate: [
            {
              path: 'owner',
              model: User
            }
          ]
        }]
      );
    fanwalls.forEach((fanwall: any) => {
      if (fanwall.dareme) {
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
      } else {
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
            goal: fanwall.fundme.goal,
            title: fanwall.fundme.title,
            category: fanwall.fundme.category,
            donuts: fanwall.fundme.wallet,
            options: null,
            voteInfo: fanwall.fundme.voteInfo,
            reward: fanwall.fundme.reward
          },
          userFanwall: true
        });
      }
    });

    //get Tips data.
    const tips = await Tip.find({ user: user._id, show: true }).populate({ path: 'tipper', select: { 'avatar': 1, 'name': 1 } });
    let resultTips = tips.sort((first: any, second: any) => {
      return first.tip < second.tip ? 1 : first.tip > second.tip ? -1 :
        first.date > second.date ? -1 : first.date < second.date ? 1 : 0;
    });
    return res.status(200).json({ success: true, fanwalls: resFanwalls, tips: resultTips, user: user });
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
        .populate([
          {
            path: 'dareme',
            Model: DareMe,
            populate: [
              {
                path: 'options.option',
                model: Option
              },
              {
                path: 'owner',
                model: User
              }
            ]
          },
          {
            path: 'fundme',
            Model: FundMe,
            populate: [
              {
                path: 'owner',
                model: User
              }
            ]
          }
        ]);

      return res.status(200).json({ success: true, fanwall: resFanwall });
    }
  } catch (err) {
    console.log(err);
  }
}

export const unlockFanwall = async (req: Request, res: Response) => {
  try {
    const { userId, fanwallId } = req.body;
    const fanwall = await Fanwall.findById(fanwallId);
    const result = await Promise.all([
      User.findById(userId),
      User.findById(fanwall.writer),
      AdminWallet.findOne({ admin: "ADMIN" })
    ]);

    const userWallet = result[0].wallet - 500;
    const ownerWallet = result[1].wallet + 450;
    const adminWallet = result[2].wallet + 50;

    const result1 = await Promise.all([
      User.findByIdAndUpdate(userId, { wallet: userWallet }, { new: true }),
      User.findByIdAndUpdate(fanwall.writer, { wallet: ownerWallet }),
      AdminWallet.findOneAndUpdate({ admin: "ADMIN" }, { wallet: adminWallet })
    ]);

    req.body.io.to(result[0].email).emit("wallet_change", userWallet);
    req.body.io.to(result[1].email).emit("wallet_change", ownerWallet);
    req.body.io.to("ADMIN").emit("wallet_change", adminWallet);

    const payload = {
      id: result1[0]._id,
      name: result1[0].name,
      avatar: result1[0].avatar,
      role: result1[0].role,
      email: result1[0].email,
      wallet: result1[0].wallet,
      personalisedUrl: result1[0].personalisedUrl,
      language: result1[0].language,
      category: result1[0].categories,
      new_notification: result1[0].new_notification,
    };

    const currentTime = calcTime();

    const newTransaction1 = new AdminUserTransaction({
      description: 10,
      from: 'USER',
      to: 'ADMIN',
      user: userId,
      donuts: 50,
      date: currentTime
    });

    const newTransaction2 = new AdminUserTransaction({
      description: 10,
      from: 'USER',
      to: 'USER',
      user: userId,
      user1: fanwall.writer,
      donuts: 450,
      date: currentTime
    });

    await Promise.all([
      newTransaction1.save(),
      newTransaction2.save()
    ])

    let unlocks = fanwall.unlocks;
    unlocks.push({ unlocker: userId });
    await Fanwall.findByIdAndUpdate(fanwallId, { unlocks: unlocks });
    const resFanwall = await Fanwall.findById(fanwallId)
      .populate({ path: 'writer', select: { 'avatar': 1, 'name': 1, 'personalisedUrl': 1 } })
      .populate([
        {
          path: 'dareme',
          Model: DareMe,
          populate: [
            {
              path: 'options.option',
              model: Option
            },
            {
              path: 'owner',
              model: User
            }
          ]
        },
        {
          path: 'fundme',
          Model: FundMe,
          populate: [
            {
              path: 'owner',
              model: User
            }
          ]
        }
      ]);

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


/**
 * 
 * 
 */
export const modityIssue = async (req: Request, res: Response) => {
  try {
    const transactions = await AdminUserTransaction.find({ description: 4 });
    if (transactions.length > 0) {
      transactions.map((item: any) => {
        if (item.from == 'DAREME' && new Date(item.date) < new Date('2022-06-19T21:00:00.000Z')) {
          if (item.to == 'ADMIN') {
            AdminUserTransaction.findByIdAndUpdate(item._id, { to: 'USER' }).then((r: any) => console.log(r));
          } else if (item.to == 'USER') {
            AdminUserTransaction.findByIdAndUpdate(item._id, { to: 'ADMIN' }).then((r: any) => console.log(r));
          }
        }
      });
      return res.status(200).json({ success: true });
    }
    return res.status(200).json({ success: true, status: 0 })
  } catch (err) {
    return res.status(200).json({ error: err });
  }
}

export const getTransaction = async (req: Request, res: Response) => {
  const { transactionId } = req.params;
  const transaction = await AdminUserTransaction.findById(transactionId);
  if (transaction) {
    return res.status(200).json(transaction);
  } else return res.status(200).json({ error: true });
}


export const setTransaction = async (req: Request, res: Response) => {
  const { transactionId } = req.params;
  const { donuts, description, from, to } = req.body;
  await AdminUserTransaction.findByIdAndUpdate(transactionId, { from: from, to: to, description: description, donuts: donuts });
  return res.status(200).json({ success: true });
}

export const setUser = async (req: Request, res: Response) => {
  const transactions = await AdminUserTransaction.find({ description: 4, from: 'DAREME', to: 'USER' });
  if (transactions.length > 0) {
    transactions.map((item: any) => {
      let admin = AdminUserTransaction.findOne({ dareme: item.dareme, description: 4, from: 'DAREME', to: 'ADMIN' });
      AdminUserTransaction.findByIdAndUpdate(item._id, { user: admin.user ? admin.user : item.user ? item.user : 'admin' });
    });
    return res.status(200).json({ success: true });
  } else return res.status(200).json({ error: true });
}

export const checkTransaction = async (req: Request, res: Response) => {
  const { transactionId } = req.params;
  const log = await AdminUserTransaction.findById(transactionId);
  const result = await AdminUserTransaction.findOne({ dareme: log.dareme, description: 4, from: 'DAREME', to: 'USER' });
  if (result) return res.status(200).json(result);
  else return res.status(200).json({ error: true });
}

export const dumpFanwall = async (req: Request, res: Response) => {
  const fanwalls = await Fanwall.find({});
  return res.status(200).json(fanwalls);
}
