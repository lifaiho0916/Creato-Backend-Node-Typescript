import mongoose from "mongoose";

const UserSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
  },
  avatar: {
    type: String,
    default: "",
  },
  name: {
    type: String,
    required: true,
  },
  password: {
    type: String,
    required: true,
  },
  wallet: {
    type: Number,
    required: true,
  },
  role: {
    type: String,
    default: "USER",
  },
  personalisedUrl: {
    type: String,
    default: "",
  },
  categories: [
    {
      type: Number,
    },
  ],
  language: {
    type: String,
    default: "EN",
  },
  date: {
    type: Date,
  },
  new_notification: {
    type: Boolean,
    default: false,
  },
  subscribed_users: [
    {
      type: mongoose.Schema.Types.ObjectId,
    },
  ],
  stripeID: {
    type: String
  }
});

export default mongoose.model("users", UserSchema);
