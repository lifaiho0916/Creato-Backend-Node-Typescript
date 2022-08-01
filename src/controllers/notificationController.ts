import { Request, Response } from "express";
import User from "../models/User";
import Dareme from "../models/DareMe";
import Notification from "../models/Notification";
import NotificationSetting from "../models/NotificationSetting";
import NotificationType from "../models/NotificationType";

function calcTime() {
  var d = new Date();
  var utc = d.getTime();
  var nd = new Date(utc + (3600000 * 8));
  return nd;
}

export const getNotificationHistory = async (req: Request, res: Response) => {
  try {
    const notifications = await Notification.find()
      .populate([
        { path: 'dareme', select: { title: 1 } },
        { path: 'fundme', select: { title: 1 } },
        { path: 'sender', select: { role: 1, avatar: 1, name: 1 } },
        { path: 'section' },
        { path: 'receiverInfo.receiver', select: { name: 1 } }
      ]).sort({ date: -1 }).select({ receiverInfo: 1, dareme: 1, sender: 1, section: 1, index: 1, date: 1 });

    let result: Array<any> = [];

    for (const notification of notifications) {
      let msg = notification.section.info[notification.index].contentEn;
      if (msg.indexOf('DAREME_TITLE') !== -1) msg = msg.replace('DAREME_TITLE', `<strong>${notification.dareme.title}</strong>`);
      if (msg.indexOf('FUNDME_TITLE') !== -1) msg = msg.replace('FUNDME_TITLE', `<strong>${notification.fundme.title}</strong>`);
      if (msg.indexOf('NAME_OF_OWNER') !== -1) msg = msg.replace('NAME_OF_OWNER', `<strong>${notification.sender.name}</strong>`);

      for (const resInfo of notification.receiverInfo) {
        result.push({
          id: notification._id,
          section: notification.section.section,
          condition: notification.section.info[notification.index],
          sender: notification.sender,
          receiver: resInfo.receiver,
          date: notification.date,
          msg: msg
        });
      }
    }

    return res.status(200).json({ success: true, list: result });
  } catch (err) {
    console.log(err);
  }
}

export const getNotifications = async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;

    const notifications = await Notification.find({ receiverInfo: { $elemMatch: { receiver: userId } } })
      .populate([
        { path: 'dareme', select: { title: 1 } },
        { path: 'fundme', select: { title: 1 } },
        { path: 'sender', select: { role: 1, avatar: 1, name: 1 } },
        { path: 'section' },
        { path: 'receiverInfo.receiver', select: { name: 1 } }
      ]).sort({ date: -1 }).select({ receiverInfo: 1, dareme: 1, sender: 1, section: 1, index: 1, date: 1 });

    let result: Array<any> = [];

    notifications.forEach((notification: any) => {
      let msg = notification.section.info[notification.index].contentEn;
      if (msg.indexOf('DAREME_TITLE') !== -1) msg = msg.replace('DAREME_TITLE', `<strong>${notification.dareme.title}</strong>`);
      if (msg.indexOf('FUNDME_TITLE') !== -1) msg = msg.replace('FUNDME_TITLE', `<strong>${notification.fundme.title}</strong>`);
      if (msg.indexOf('NAME_OF_OWNER') !== -1) msg = msg.replace('NAME_OF_OWNER', `<strong>${notification.sender.name}</strong>`);

      const resInfo = notification.receiverInfo.filter((info: any) => (info.receiver._id + '') === (userId + ''));
      result.push({
        id: notification._id,
        section: notification.section.section,
        sender: notification.sender,
        receiver: resInfo[0].receiver,
        read: resInfo[0].read,
        dareme: notification.dareme ? notification.dareme : null,
        fundme: notification.fundme ? notification.fundme : null,
        date: notification.date,
        msg: msg
      });
    });

    return res.status(200).json({ success: true, list: result });
  } catch (err) {
    console.log({ err });
  }
};

export const readNotification = async (req: Request, res: Response) => {
  try {
    const { notificationId, userId, readCount } = req.body;

    const notification = await Notification.findById(notificationId);
    const receiverInfo = notification.receiverInfo;
    let result: Array<any> = [];
    receiverInfo.forEach((info: any) => {
      if ((info.receiver + '') === (userId + '')) {
        result.push({
          receiver: info.receiver,
          read: true,
          read_at: calcTime()
        });
      } else result.push(info);
    });

    await Notification.findByIdAndUpdate(notificationId, { receiverInfo: result });
    if (readCount === 0) await User.findByIdAndUpdate(userId, { new_notification: false });
    return res.status(200).json({ success: true });
  } catch (err) {
    console.log({ err });
    res.json({ err });
  }
};

export const setNotification = async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;
    const updatedUser = await User.findByIdAndUpdate(userId, { new_notification: true }, { new: true });
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

    return res.status(200).json({ user: payload, success: true });
  } catch (err) {
    console.log(err);
  }
};

export const subscribeUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;
    const user = await User.findOne({ _id: id });
    const found = user.subscribed_users.find(
      (user: any) => user + "" === userId + ""
    );
    if (found) {
      let subscribed_users = user.subscribed_users.filter(
        (user: any) => user + "" !== userId
      );
      user.subscribed_users = subscribed_users;
    } else {
      user.subscribed_users.push(userId);
    }
    await user.save();
    res.status(200).json({ success: true });
  } catch (err) {
    console.log({ err });
  }
};

export const addNewNotification = async (io: any, data: any) => {
  try {
    const type = await NotificationType.findOne({ section: data.section });
    if (type === null) {
      console.log('Get Notification Type Error');
      return;
    }

    let currentTime = calcTime();
    let notifications: Array<any> = [];
    let notifyUsers: Array<any> = [];
    let setUserNotifyTrue: Array<any> = [];

    if (data.section === 'Create DareMe') {
      var index = 0;
      const result = await Promise.all([
        User.findById(data.dareme.owner),
        User.findOne({ role: 'ADMIN' })
      ]);
      const user = result[0];

      for (const info of type.info) {
        if (info.trigger === 'After created a DareMe') {
          /*
            section: 'Create DareMe',
            trigger: 'After created a DareMe',
            dareme: updatedDareme,
          */
          if (info.sender === 'Admin' && info.recipient === 'Owner') {
            const admin = result[1];

            const newNotify = new Notification({
              section: type._id,
              index: index,
              sender: admin._id,
              receiverInfo: [{
                receiver: user._id
              }],
              date: currentTime,
              dareme: data.dareme._id
            });

            notifications.push(newNotify.save());
            notifyUsers.push(user.email)
          } else if (info.sender === 'Owner' && info.recipient === 'User') {
            let rInfo: Array<any> = [];

            user.subscribed_users.forEach((sUser: any) => {
              rInfo.push({ receiver: sUser });
              setUserNotifyTrue.push(User.findByIdAndUpdate(sUser, { new_notification: true }));
            });

            const newNotify = new Notification({
              section: type._id,
              index: index,
              sender: user._id,
              receiverInfo: rInfo,
              date: currentTime,
              dareme: data.dareme._id
            });

            let users: Array<any> = [];

            for (const userTemp of user.subscribed_users) users.push(User.findById(userTemp));
            let userResult = await Promise.all(users);

            notifications.push(newNotify.save());
            for (const nuser of userResult) notifyUsers.push(nuser.email);
          }

          Promise.all(setUserNotifyTrue);
          Promise.all(notifications);
          for (const notify of notifyUsers) io.to(notify).emit('create_notification');
        }
        index++;
      }
    } else if (data.section === 'Create FundMe') {
      var index = 0;
      const result = await Promise.all([
        User.findById(data.fundme.owner),
        User.findOne({ role: 'ADMIN' })
      ]);
      const user = result[0];

      for (const info of type.info) {
        if (info.trigger === 'After created a FundMe') {
          /*
            section: 'Create FundMe',
            trigger: 'After created a FundMe',
            dareme: updatedFundme,
          */
          if (info.sender === 'Admin' && info.recipient === 'Owner') {
            const admin = result[1];

            const newNotify = new Notification({
              section: type._id,
              index: index,
              sender: admin._id,
              receiverInfo: [{
                receiver: user._id
              }],
              date: currentTime,
              fundme: data.fundme._id
            });

            notifications.push(newNotify.save());
            notifyUsers.push(user.email)
          } else if (info.sender === 'Owner' && info.recipient === 'User') {
            let rInfo: Array<any> = [];

            user.subscribed_users.forEach((sUser: any) => {
              rInfo.push({ receiver: sUser });
              setUserNotifyTrue.push(User.findByIdAndUpdate(sUser, { new_notification: true }));
            });

            const newNotify = new Notification({
              section: type._id,
              index: index,
              sender: user._id,
              receiverInfo: rInfo,
              date: currentTime,
              fundme: data.fundme._id
            });

            let users: Array<any> = [];

            for (const userTemp of user.subscribed_users) users.push(User.findById(userTemp));
            let userResult = await Promise.all(users);

            notifications.push(newNotify.save());
            for (const nuser of userResult) notifyUsers.push(nuser.email);
          }

          Promise.all(setUserNotifyTrue);
          Promise.all(notifications);
          for (const notify of notifyUsers) io.to(notify).emit('create_notification');
        }
        index++;
      }
    }
  } catch (err) {
    console.log(err)
  }
}

export const newNotification = async (io: any) => {
  try {
    const currentDate = new Date();
    const oneDay = 1000 * 3600 * 24;
    const daremes = await Dareme.find({});
    const admins = await User.find({ role: "ADMIN" })
    daremes.forEach(async (dareme: any) => {
      if (currentDate.getTime() - dareme.date < dareme.deadline * oneDay) {
        let new_notification = new Notification({
          sender: admins[0],
          receivers: [dareme.owner],
          message: `xxx donuts earned in [DareMe title] & [Winning Dare] is leading!`,
          them: "Daily update of DareMe (at 23:59)",
          dareme: dareme._id,
          type: "ongoing_dareme",
        });
        await new_notification.save();

        new_notification = new Notification({
          sender: admins[0],
          receivers: [dareme.owner], //should be voters + writer
          message: `Let's see how [DareMe title] goes! Support & dare [owner name]!`,
          them: "Daily update of DareMe (at 23:59)",
          dareme: dareme._id,
          type: "ongoing_dareme"
        })
        await new_notification.save();
        io.emit("create_notification")
      }
    });
  } catch (err) {
    console.log({ err });
  }
};

export const getNotificationSetting = async (req: Request, res: Response) => {
  try {
    const setting = await NotificationSetting.findOne();
    return res.status(200).json({ success: true, setting: setting });
  } catch (err) {
    console.log(err);
  }
}

export const addNotificationSetting = async (req: Request, res: Response) => {
  try {
    const { value, type } = req.body;
    const setting = await NotificationSetting.findOne();
    if (type === 0) {
      let sections = [];
      if (setting && setting.section && setting.section.length > 0) sections = setting.section;
      sections.push({ title: value });
      if (setting === null) {
        const newSetting = new NotificationSetting({ section: sections, sender: [], recipient: [], trigger: [] });
        await newSetting.save();
      } else await NotificationSetting.findOneAndUpdate({}, { section: sections });
      return res.status(200).json({ success: true });
    } else if (type === 1) {
      let senders = [];
      if (setting && setting.sender && setting.sender.length > 0) senders = setting.sender;
      senders.push({ title: value });
      if (setting === null) {
        const newSetting = new NotificationSetting({ section: [], sender: senders, recipient: [], trigger: [] });
        await newSetting.save();
      } else await NotificationSetting.findOneAndUpdate({}, { sender: senders });
      return res.status(200).json({ success: true });
    } else if (type === 2) {
      let recipients = [];
      if (setting && setting.recipient && setting.recipient.length > 0) recipients = setting.recipient;
      recipients.push({ title: value });
      if (setting === null) {
        const newSetting = new NotificationSetting({ section: [], sender: [], recipient: recipients, trigger: [] });
        await newSetting.save();
      } else await NotificationSetting.findOneAndUpdate({}, { recipient: recipients });
      return res.status(200).json({ success: true });
    } else {
      let triggers = [];
      if (setting && setting.trigger && setting.trigger.length > 0) triggers = setting.trigger;
      triggers.push({ title: value });
      if (setting === null) {
        const newSetting = new NotificationSetting({ section: [], sender: [], recipient: [], trigger: triggers });
        await newSetting.save();
      } else await NotificationSetting.findOneAndUpdate({}, { trigger: triggers });
      return res.status(200).json({ success: true });
    }
  } catch (err) {
    console.log(err);
  }
}

export const addNotificationType = async (req: Request, res: Response) => {
  try {
    const { section, sender, receiver, trigger, mode, contentEn } = req.body;
    const notification = await NotificationType.findOne({ section: section });
    let newInfo = notification === null ? [] : notification.info;
    newInfo.push({
      sender: sender,
      recipient: receiver,
      trigger: trigger,
      auto: mode,
      contentEn: contentEn
    });
    if (notification === null) {
      const newType = new NotificationType({
        section: section,
        info: newInfo
      });

      await newType.save();
    } else await NotificationType.findByIdAndUpdate(notification._id, { info: newInfo });

    return res.status(200).json({ success: true });
  } catch (err) {
    console.log(err);
  }
}

export const getNotificationType = async (req: Request, res: Response) => {
  try {
    const types = await NotificationType.find();

    return res.status(200).json({ success: true, types: types });
  } catch (err) {
    console.log(err)
  }
}

export const setNotificationAuto = async (req: Request, res: Response) => {
  try {
    const { id, no, auto } = req.body;
    const type = await NotificationType.findById(id);
    let info = type.info;
    info[no].auto = auto;
    await NotificationType.findByIdAndUpdate(id, { info: info });

    return res.status(200).json({ success: true });
  } catch (err) {
    console.log(err);
  }
} 