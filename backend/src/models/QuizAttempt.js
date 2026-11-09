import mongoose from "mongoose";

const quizAttemptSchema = new mongoose.Schema(
  {
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      required: true,
    },
    quizId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Quiz",
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    answers: {
      type: [{ type: Number, min: 0, max: 3, validate: Number.isInteger }],
      required: true,
      default: undefined,
      validate: {
        validator: (answers) => answers.length >= 1 && answers.length <= 20,
        message: "An attempt must contain 1 to 20 answers.",
      },
    },
    correct: {
      type: Number,
      required: true,
      min: 0,
      validate: Number.isInteger,
    },
    total: {
      type: Number,
      required: true,
      min: 1,
      max: 20,
      validate: Number.isInteger,
    },
  },
  { timestamps: true },
);

quizAttemptSchema.pre("validate", function () {
  if (this.answers?.length !== this.total) {
    this.invalidate("total", "Total must match the number of answers.");
  }

  if (this.correct > this.total) {
    this.invalidate("correct", "Correct answers cannot exceed the total.");
  }
});

quizAttemptSchema.index({ groupId: 1, quizId: 1, userId: 1, correct: -1 });

export const QuizAttempt = mongoose.model("QuizAttempt", quizAttemptSchema);
