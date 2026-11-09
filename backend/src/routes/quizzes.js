import { Router } from "express";
import mongoose from "mongoose";
import { requireSession } from "../middleware/requireSession.js";
import { Group } from "../models/Group.js";
import { Membership } from "../models/Membership.js";
import { Quiz } from "../models/Quiz.js";
import { QuizAttempt } from "../models/QuizAttempt.js";
import { User } from "../models/User.js";

const router = Router();
const quizzesPath = "/groups/:groupId/quizzes";
const maxQuestions = 20;

function fail(res, status, code, message) {
  return res.status(status).json({ error: { code, message } });
}

function cleanText(value, maxLength) {
  if (typeof value !== "string") return null;

  const text = value.trim();
  return text.length > 0 && text.length <= maxLength ? text : null;
}

async function requireGroupAccess(req, res, next) {
  const { groupId } = req.params;

  if (!mongoose.isObjectIdOrHexString(groupId)) {
    return fail(res, 404, "GROUP_NOT_FOUND", "Group not found.");
  }

  const group = await Group.findOne({ _id: groupId, deletedAt: null })
    .select("ownerId")
    .lean();

  if (!group) {
    return fail(res, 404, "GROUP_NOT_FOUND", "Group not found.");
  }

  const isMember =
    group.ownerId.equals(req.user._id) ||
    Boolean(
      await Membership.exists({ groupId: group._id, userId: req.user._id }),
    );

  if (!isMember) {
    return fail(res, 404, "GROUP_NOT_FOUND", "Group not found.");
  }

  req.studyGroup = group;
  next();
}

async function requireQuiz(req, res, next) {
  const { quizId } = req.params;

  if (!mongoose.isObjectIdOrHexString(quizId)) {
    return fail(res, 404, "QUIZ_NOT_FOUND", "Practice set not found.");
  }

  const quiz = await Quiz.findOne({
    _id: quizId,
    groupId: req.studyGroup._id,
  }).lean();

  if (!quiz) {
    return fail(res, 404, "QUIZ_NOT_FOUND", "Practice set not found.");
  }

  req.studyQuiz = quiz;
  next();
}

function quizSummary(quiz) {
  return {
    id: String(quiz._id),
    title: quiz.title,
    kind: quiz.kind,
  };
}

const groupAccess = [requireSession, requireGroupAccess];

router.get(quizzesPath, ...groupAccess, async (req, res) => {
  const quizzes = await Quiz.find({ groupId: req.studyGroup._id })
    .select("title kind")
    .sort({ createdAt: -1, _id: -1 })
    .lean();

  res.json({ quizzes: quizzes.map(quizSummary) });
});

router.post(quizzesPath, ...groupAccess, async (req, res) => {
  const title = cleanText(req.body?.title, 100);
  const kind = req.body?.kind;
  const input = req.body?.questions;

  if (
    !title ||
    !["quiz", "flashcards"].includes(kind) ||
    !Array.isArray(input) ||
    input.length < 1 ||
    input.length > maxQuestions
  ) {
    return fail(
      res,
      400,
      "INVALID_PRACTICE_SET",
      "Enter a title, choose a format, and add 1–20 questions or cards.",
    );
  }

  const questions = [];

  for (const [index, item] of input.entries()) {
    const prompt = cleanText(item?.prompt, 300);

    if (!prompt) {
      return fail(
        res,
        400,
        "INVALID_PROMPT",
        `Enter a prompt for item ${index + 1}.`,
      );
    }

    if (kind === "flashcards") {
      const answer = cleanText(item.answer, 500);

      if (!answer) {
        return fail(
          res,
          400,
          "INVALID_ANSWER",
          `Enter an answer for card ${index + 1}.`,
        );
      }

      questions.push({ prompt, answer });
      continue;
    }

    const options = Array.isArray(item.options)
      ? item.options.map((value) => cleanText(value, 200))
      : [];

    if (
      options.length !== 4 ||
      options.some((option) => !option) ||
      !Number.isInteger(item.correctIndex) ||
      item.correctIndex < 0 ||
      item.correctIndex >= options.length
    ) {
      return fail(
        res,
        400,
        "INVALID_OPTIONS",
        `Question ${index + 1} needs four options and a valid correct option.`,
      );
    }

    questions.push({ prompt, options, correctIndex: item.correctIndex });
  }

  const quiz = await Quiz.create({
    groupId: req.studyGroup._id,
    createdBy: req.user._id,
    title,
    kind,
    questions,
  });

  res.status(201).json({ quiz: quizSummary(quiz) });
});

router.get(
  `${quizzesPath}/:quizId`,
  ...groupAccess,
  requireQuiz,
  (req, res) => {
    const quiz = req.studyQuiz;

    const questions = quiz.questions.map((question) =>
      quiz.kind === "flashcards"
        ? { prompt: question.prompt, answer: question.answer }
        : { prompt: question.prompt, options: question.options },
    );

    res.json({ quiz: { ...quizSummary(quiz), questions } });
  },
);

router.post(
  `${quizzesPath}/:quizId/attempts`,
  ...groupAccess,
  requireQuiz,
  async (req, res) => {
    const quiz = req.studyQuiz;
    const answers = req.body?.answers;

    if (quiz.kind !== "quiz") {
      return fail(
        res,
        400,
        "QUIZ_REQUIRED",
        "Flashcards do not have scored attempts.",
      );
    }

    if (
      !Array.isArray(answers) ||
      answers.length !== quiz.questions.length ||
      answers.some(
        (answer, index) =>
          !Number.isInteger(answer) ||
          answer < 0 ||
          answer >= quiz.questions[index].options.length,
      )
    ) {
      return fail(
        res,
        400,
        "INVALID_ATTEMPT",
        "Choose one valid answer for every question.",
      );
    }

    const review = quiz.questions.map((question, index) => ({
      selectedIndex: answers[index],
      correctIndex: question.correctIndex,
    }));

    const total = review.length;
    const correct = review.filter(
      ({ selectedIndex, correctIndex }) => selectedIndex === correctIndex,
    ).length;

    await QuizAttempt.create({
      groupId: req.studyGroup._id,
      quizId: quiz._id,
      userId: req.user._id,
      answers,
      correct,
      total,
    });

    res.status(201).json({ score: { correct, total }, review });
  },
);

router.get("/groups/:groupId/leaderboard", ...groupAccess, async (req, res) => {
  const standings = await QuizAttempt.aggregate([
    { $match: { groupId: req.studyGroup._id } },
    {
      $group: {
        _id: { userId: "$userId", quizId: "$quizId" },
        best: { $max: "$correct" },
      },
    },
    {
      $group: {
        _id: "$_id.userId",
        points: { $sum: "$best" },
      },
    },
    { $sort: { points: -1, _id: 1 } },
    { $limit: 50 },
  ]);

  const users = await User.find({
    _id: { $in: standings.map((entry) => entry._id) },
  })
    .select("name")
    .lean();

  const names = new Map(users.map((user) => [String(user._id), user.name]));

  res.json({
    leaderboard: standings.map((entry) => ({
      userId: String(entry._id),
      name: names.get(String(entry._id)) ?? "Former member",
      points: entry.points,
    })),
  });
});

export default router;
