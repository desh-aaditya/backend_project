import mongoose,{Schema} from "mongoose";

const subscriptionSchema = new Schema({
    subscriber: { //one wjo is subscribing
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    channel: { //channel to which the user is subscribing
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
},{
    timestamps: true
});

export const Subscription = mongoose.model("Subscription", subscriptionSchema);