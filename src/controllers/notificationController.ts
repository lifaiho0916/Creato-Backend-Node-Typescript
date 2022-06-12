import { Request, Response } from "express";
import User from "../models/User";
import Dareme from "../models/DareMe";
import Notification from "../models/Notification";

export const getNotifications = async (req: Request, res: Response) => {
  try {
    let output: any[] = [];
    const notifications = await Notification.find({}).populate({
      path: "sender",
    });
    let user = await User.findById(req.body.userId);
    let unread = 0;
    notifications &&
      notifications.forEach(async (notification: any) => {
        await notification.receivers.forEach((receiver: any) => {
          if (receiver + "" === req.body.userId + "") {
            let read = false;
            notification.read.forEach((item: any) => {
              if (item.read_by + "" === req.body.userId) {
                read = true;
              }
            });
            if (read === false) unread++;
            output.push({
              _id: notification._id,
              sender: {
                avatar: notification.sender.avatar,
                name: notification.sender.name,
                email: notification.sender.email,
                role: notification.sender.role,
              },
              message: notification.message,
              read: read,
              created_at: notification.created_at,
              type: notification.type,
              dareme: notification.dareme,
            });
          }
        });
      });
    output = output.sort(
      (objA, objB) => objB.created_at.getTime() - objA.created_at.getTime()
    );
    if (unread === 0) {
      user.new_notification = false;
    } else {
      user.new_notification = true;
    }
    await user.save();
    res
      .status(200)
      .json({ notifications: output, new_notification: user.new_notification });
  } catch (err) {
    console.log({ err });
  }
};

export const readNotification = async (req: Request, res: Response) => {
  try {
    if (!req.body.notificationId) throw Error("Notification id is required!");
    let notification = await Notification.findOne({
      _id: req.body.notificationId,
    });
    if (notification) {
      notification.read.forEach((read: any) => {
        if (read.read_by + "" === req.body.userId + "")
          return res.json({
            msg: "This notification was already read",
            success: false,
          });
      });
      notification.read.push({ read_by: req.body.userId });
      await notification.save();
      return res.status(200).json({
        msg: "read notification success!",
        success: true,
        notification,
      });
    } else {
      throw Error("Not found notification!");
    }
  } catch (err) {
    console.log({ err });
    res.json({ err });
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
