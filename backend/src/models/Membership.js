import mongoose from "mongoose";

const membershipSchema = new mongoose.Schema(
  {
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true },
);

membershipSchema.index({ groupId: 1, userId: 1 }, { unique: true });
membershipSchema.index({ userId: 1, groupId: 1 });

export const Membership = mongoose.model("Membership", membershipSchema);
