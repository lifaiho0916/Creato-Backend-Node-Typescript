import mongoose, { Schema } from "mongoose";
import User from "./User";
import Dareme from "./DareMe";
import Fundme from "./FundMe";
import NotificationType from './NotificationType';

const NotificationSchema = new mongoose.Schema({
  section: {
    type: Schema.Types.ObjectId,
    ref: NotificationType
  },
  index: {
    type: Number
  },
  sender: {
    type: Schema.Types.ObjectId,
    ref: User,
  },
  receiverInfo: [{
    _id: false,
    receiver: {
      type: Schema.Types.ObjectId,
      ref: User,
    },
    read: {
      type: Boolean,
      default: false
    },
    read_at: {
      type: Date
    }
  }],
  date: {
    type: Date,
  },
  dareme: {
    type: Schema.Types.ObjectId,
    ref: Dareme,
  },
  fundme: {
    type: Schema.Types.ObjectId,
    ref: Fundme,
  }, 
});

export default mongoose.model("notifications", NotificationSchema);
