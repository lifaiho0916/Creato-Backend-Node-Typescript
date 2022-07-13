import mongoose, { Schema } from 'mongoose';
import User from './User';

const TipSchema = new mongoose.Schema({
  nickname: {
    type: String
  },
  tipper: {
    type: Schema.Types.ObjectId,
    ref: User
  },
  tip: {
    type: Number
  },
  message: {
    type: String
  },
  user: {
    type: Schema.Types.ObjectId,
    ref: User
  },
  date: {
    type: Date,
    default: Date.now()
  }
});

export default mongoose.model("tips", TipSchema);