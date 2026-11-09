import mongoose from "mongoose";

const ONE_HOUR_MS = 60 * 60 * 1000;

const tutorSlotSchema = new mongoose.Schema(
  {
    tutorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TutorProfile",
      required: true,
    },
    startsAt: {
      type: Date,
      required: true,
      validate: {
        validator: (value) => value.getTime() % ONE_HOUR_MS === 0,
        message: "Slots must start on an hourly UTC boundary.",
      },
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

tutorSlotSchema.index({ tutorId: 1, startsAt: 1 }, { unique: true });

export const TutorSlot = mongoose.model("TutorSlot", tutorSlotSchema);
