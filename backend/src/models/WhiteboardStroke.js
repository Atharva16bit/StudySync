import mongoose from "mongoose";

const pointSchema = new mongoose.Schema(
  {
    x: { type: Number, required: true, min: 0, max: 1 },
    y: { type: Number, required: true, min: 0, max: 1 },
  },
  { _id: false },
);

const whiteboardStrokeSchema = new mongoose.Schema(
  {
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      required: true,
    },
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    strokeId: {
      type: String,
      required: true,
      maxlength: 64,
    },
    color: {
      type: String,
      required: true,
      match: /^#[a-f0-9]{6}$/i,
    },
    width: {
      type: Number,
      required: true,
      min: 1,
      max: 20,
    },
    points: {
      type: [pointSchema],
      required: true,
      default: undefined,
      validate: {
        validator: (points) => points.length >= 1 && points.length <= 1000,
        message: "A stroke must contain 1 to 1000 points.",
      },
    },
  },
  { timestamps: true },
);

whiteboardStrokeSchema.index({ groupId: 1, strokeId: 1 }, { unique: true });

whiteboardStrokeSchema.index({ groupId: 1, createdAt: 1, _id: 1 });

export const WhiteboardStroke = mongoose.model(
  "WhiteboardStroke",
  whiteboardStrokeSchema,
);
