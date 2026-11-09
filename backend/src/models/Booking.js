import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema(
  {
    slotId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TutorSlot",
      required: true,
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    bookedRatePaise: {
      type: Number,
      required: true,
      min: 1,
      validate: Number.isSafeInteger,
    },
    status: {
      type: String,
      enum: ["confirmed", "cancelled"],
      default: "confirmed",
      required: true,
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

bookingSchema.index(
  { slotId: 1 },
  {
    unique: true,
    partialFilterExpression: { status: "confirmed" },
  },
);

bookingSchema.index({ studentId: 1, createdAt: -1 });

export const Booking = mongoose.model("Booking", bookingSchema);
