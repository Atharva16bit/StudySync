import mongoose from "mongoose";

const resourceSchema = new mongoose.Schema(
  {
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      required: true,
    },
    uploaderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    objectKey: {
      type: String,
      required: true,
    },
    filename: {
      type: String,
      required: true,
      trim: true,
      maxlength: 255,
    },
    mimeType: {
      type: String,
      enum: ["application/pdf", "image/png", "image/jpeg", "image/webp"],
      required: true,
    },
    sizeBytes: {
      type: Number,
      required: true,
      min: 1,
      max: 10 * 1024 * 1024,
      validate: Number.isInteger,
    },
  },
  { timestamps: true },
);

resourceSchema.index({ objectKey: 1 }, { unique: true });
resourceSchema.index({ groupId: 1, createdAt: -1, _id: -1 });

export const Resource = mongoose.model("Resource", resourceSchema);
