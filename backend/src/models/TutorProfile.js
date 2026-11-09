import mongoose from "mongoose";

const tutorProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    subjects: {
      type: [{ type: String, trim: true, maxlength: 60 }],
      required: true,
      default: undefined,
      validate: {
        validator: (subjects) =>
          subjects.length >= 1 &&
          subjects.length <= 10 &&
          subjects.every((subject) => Boolean(subject)),
        message: "Enter between 1 and 10 subjects.",
      },
    },
    bio: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    hourlyRatePaise: {
      type: Number,
      required: true,
      min: 1,
      validate: Number.isSafeInteger,
    },
    verificationStatus: {
      type: String,
      enum: ["pending", "verified", "rejected"],
      default: "pending",
      required: true,
    },
  },
  { timestamps: true },
);

tutorProfileSchema.index({ userId: 1 }, { unique: true });
tutorProfileSchema.index({ verificationStatus: 1, createdAt: -1 });

export const TutorProfile = mongoose.model("TutorProfile", tutorProfileSchema);
