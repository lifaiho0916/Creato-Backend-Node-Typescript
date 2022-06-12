import express from "express";
const router = express.Router();
import auth from "../../middleware/auth";

import {
  getNotifications,
  readNotification,
  subscribeUser,
} from "../../controllers/notificationController";

router.get("/get_notifications", auth, getNotifications);
router.post("/read_notification", auth, readNotification);
router.post("/subscribe_user/:id", auth, subscribeUser);

export default router;
