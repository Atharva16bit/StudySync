import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      required: true,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    clientMessageId: {
      type: String,
      required: true,
      maxlength: 64,
    },
    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
  },
  { timestamps: true },
);

messageSchema.index(
  { groupId: 1, senderId: 1, clientMessageId: 1 },
  { unique: true },
);

messageSchema.index({ groupId: 1, createdAt: -1, _id: -1 });

export const Message = mongoose.model("Message", messageSchema);
