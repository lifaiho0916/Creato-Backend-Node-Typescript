import monogoose, { Schema } from 'mongoose';
import User from './User';
import Option from './Option';

const FundMeSchema = new monogoose.Schema({
    owner: {
        type: Schema.Types.ObjectId,
        ref: User
    },
    title: {
        type: String,
    },
    deadline: {
        type: Number,
    },
    category: {
        type: Number,
    },
    teaser: {
        type: String,
    },
    reward: {
        type: Number,
    },
    rewardTitle: {
        type: String,
    },
    goal: {
        type: Number,
    },
    published: {
        type: Boolean,
        required: true
    },
    finished: {
        type: Boolean,
        default: false
    },
    wallet: {
        type: Number,
        default: 0
    },
    cover: {
        type: String
    },
    coverIndex: {
        type: Number
    },
    sizeType: {
        type: Boolean
    },
    show: {
        type: Boolean,
        default: true
    },
    date: {
        type: Date,
        default: Date.now()
    }
});

export default monogoose.model("fundmes", FundMeSchema);