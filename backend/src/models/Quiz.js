import mongoose from "mongoose";

const questionSchema = new mongoose.Schema(
  {
    prompt: {
      type: String,
      required: true,
      trim: true,
      maxlength: 300,
    },
    options: {
      type: [{ type: String, trim: true, maxlength: 200 }],
      default: undefined,
    },
    correctIndex: {
      type: Number,
      min: 0,
      max: 3,
      validate: Number.isInteger,
    },
    answer: {
      type: String,
      trim: true,
      maxlength: 500,
    },
  },
  { _id: false },
);

const quizSchema = new mongoose.Schema(
  {
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    kind: {
      type: String,
      enum: ["quiz", "flashcards"],
      required: true,
    },
    questions: {
      type: [questionSchema],
      required: true,
      default: undefined,
    },
  },
  { timestamps: true },
);

quizSchema.path("questions").validate(function (questions) {
  if (!questions.length || questions.length > 20) return false;

  if (this.kind === "flashcards") {
    return questions.every(
      (question) =>
        Boolean(question?.answer) &&
        question.options === undefined &&
        question.correctIndex === undefined,
    );
  }

  return questions.every(
    (question) =>
      question?.options?.length === 4 &&
      question.options.every((option) => Boolean(option)) &&
      Number.isInteger(question.correctIndex) &&
      question.correctIndex >= 0 &&
      question.correctIndex < question.options.length &&
      question.answer === undefined,
  );
}, "Questions must match the selected format and contain 1 to 20 items.");

quizSchema.index({ groupId: 1, createdAt: -1, _id: -1 });

export const Quiz = mongoose.model("Quiz", quizSchema);
