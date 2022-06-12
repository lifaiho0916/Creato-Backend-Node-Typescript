import mongoose, { Schema } from "mongoose";
import User from "./User";
import Dareme from "./DareMe";
// import Fundme from "./FundMe";

const NotificationSchema = new mongoose.Schema({
  sender: {
    type: Schema.Types.ObjectId,
    ref: User,
  },
  receivers: [
    {
      type: Schema.Types.ObjectId,
      ref: User,
    },
  ],
  message: {
    type: String,
  },
  created_at: {
    type: Date,
    default: Date.now(),
  },
  read: [
    {
      read_by: {
        type: Schema.Types.ObjectId,
        ref: User,
      },
      read_at: {
        type: Date,
        default: Date.now(),
      },
    },
  ],
  theme: {
    type: String,
  },
  dareme: {
    type: Schema.Types.ObjectId,
    ref: Dareme,
  },
  // fundme: {
  //   type: Schema.Types.ObjectId,
  //   ref: Fundme,
  // }, 
  type: {
    type: String,
  },
});

export default mongoose.model("notifications", NotificationSchema);
