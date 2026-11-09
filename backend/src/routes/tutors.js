import { Router } from "express";
import mongoose from "mongoose";
import { requireSession } from "../middleware/requireSession.js";
import { Booking } from "../models/Booking.js";
import { TutorProfile } from "../models/TutorProfile.js";
import { TutorSlot } from "../models/TutorSlot.js";
import { User } from "../models/User.js";

const router = Router();
const hourMs = 60 * 60 * 1000;

function fail(res, status, code, message) {
  return res.status(status).json({ error: { code, message } });
}

function isId(value) {
  return typeof value === "string" && mongoose.isObjectIdOrHexString(value);
}

function requireAdmin(req, res, next) {
  if (req.user.role !== "admin") {
    return fail(res, 403, "ADMIN_REQUIRED", "Admin access is required.");
  }

  next();
}

function profileSummary(profile) {
  return {
    id: String(profile._id),
    userId: String(profile.userId),
    subjects: profile.subjects,
    bio: profile.bio,
    hourlyRate: profile.hourlyRatePaise / 100,
    verificationStatus: profile.verificationStatus,
  };
}

router.get("/tutors", async (_req, res) => {
  const profiles = await TutorProfile.find({ verificationStatus: "verified" })
    .sort({ createdAt: -1, _id: -1 })
    .lean();

  const [users, slots] = await Promise.all([
    User.find({ _id: { $in: profiles.map((profile) => profile.userId) } })
      .select("name")
      .lean(),
    TutorSlot.find({
      tutorId: { $in: profiles.map((profile) => profile._id) },
      cancelledAt: null,
      startsAt: { $gt: new Date() },
    })
      .sort({ startsAt: 1, _id: 1 })
      .lean(),
  ]);

  const bookedSlots = await Booking.find({
    slotId: { $in: slots.map((slot) => slot._id) },
    status: "confirmed",
  })
    .select("slotId")
    .lean();

  const booked = new Set(bookedSlots.map((booking) => String(booking.slotId)));
  const names = new Map(users.map((user) => [String(user._id), user.name]));
  const slotsByTutor = new Map();

  for (const slot of slots) {
    const id = String(slot._id);
    if (booked.has(id)) continue;

    const tutorId = String(slot.tutorId);
    const available = slotsByTutor.get(tutorId) ?? [];
    available.push({ id, startsAt: slot.startsAt });
    slotsByTutor.set(tutorId, available);
  }

  const tutors = profiles.flatMap((profile) => {
    const name = names.get(String(profile.userId));
    if (!name) return [];

    return [
      {
        id: String(profile._id),
        name,
        subjects: profile.subjects,
        bio: profile.bio,
        hourlyRate: profile.hourlyRatePaise / 100,
        slots: slotsByTutor.get(String(profile._id)) ?? [],
      },
    ];
  });

  res.json({ tutors });
});

router.get("/tutors/me", requireSession, async (req, res) => {
  const profile = await TutorProfile.findOne({ userId: req.user._id });

  if (!profile) {
    return res.json({ profile: null, slots: [] });
  }

  const slots = await TutorSlot.find({
    tutorId: profile._id,
    cancelledAt: null,
    startsAt: { $gt: new Date() },
  })
    .sort({ startsAt: 1 })
    .lean();

  res.json({
    profile: profileSummary(profile),
    slots: slots.map((slot) => ({
      id: String(slot._id),
      startsAt: slot.startsAt,
    })),
  });
});

router.put("/tutors/me", requireSession, async (req, res) => {
  const { subjects, bio, hourlyRatePaise } = req.body ?? {};

  if (
    !Array.isArray(subjects) ||
    subjects.length < 1 ||
    subjects.length > 10 ||
    subjects.some(
      (subject) =>
        typeof subject !== "string" ||
        !subject.trim() ||
        subject.trim().length > 60,
    ) ||
    typeof bio !== "string" ||
    !bio.trim() ||
    bio.trim().length > 1000 ||
    !Number.isSafeInteger(hourlyRatePaise) ||
    hourlyRatePaise < 1
  ) {
    return fail(
      res,
      400,
      "INVALID_TUTOR_PROFILE",
      "Enter 1–10 subjects, a bio of up to 1000 characters, and a positive rate in paise.",
    );
  }

  const profile = await TutorProfile.findOneAndUpdate(
    { userId: req.user._id },
    {
      $set: {
        subjects: subjects.map((subject) => subject.trim()),
        bio: bio.trim(),
        hourlyRatePaise,
        verificationStatus: "pending",
      },
    },
    { upsert: true, new: true, runValidators: true },
  );

  res.json({ profile: profileSummary(profile) });
});

router.get(
  "/tutors/review",
  requireSession,
  requireAdmin,
  async (_req, res) => {
    const profiles = await TutorProfile.find({
      verificationStatus: "pending",
    }).sort({ createdAt: 1, _id: 1 });

    res.json({ profiles: profiles.map(profileSummary) });
  },
);

router.patch(
  "/tutors/:tutorId/verification",
  requireSession,
  requireAdmin,
  async (req, res) => {
    const { tutorId } = req.params;
    const { status } = req.body ?? {};

    if (!isId(tutorId) || !["verified", "rejected"].includes(status)) {
      return fail(
        res,
        400,
        "INVALID_REVIEW",
        "Choose a valid tutor and review status.",
      );
    }

    const profile = await TutorProfile.findOneAndUpdate(
      { _id: tutorId, verificationStatus: "pending" },
      { $set: { verificationStatus: status } },
      { new: true, runValidators: true },
    );

    if (!profile) {
      return fail(
        res,
        409,
        "REVIEW_UNAVAILABLE",
        "This profile is no longer pending review.",
      );
    }

    res.json({ profile: profileSummary(profile) });
  },
);

router.post("/tutors/me/slots", requireSession, async (req, res) => {
  const profile = await TutorProfile.findOne({ userId: req.user._id });

  if (!profile) {
    return fail(
      res,
      404,
      "TUTOR_PROFILE_REQUIRED",
      "Create a tutor profile first.",
    );
  }

  const value = req.body?.startsAt;
  const startsAt = typeof value === "string" ? new Date(value) : new Date(NaN);
  const timestamp = startsAt.getTime();

  if (
    !Number.isFinite(timestamp) ||
    timestamp <= Date.now() ||
    timestamp % hourMs !== 0
  ) {
    return fail(
      res,
      400,
      "INVALID_SLOT",
      "Choose a future slot starting on an hourly UTC boundary.",
    );
  }

  try {
    const slot = await TutorSlot.create({ tutorId: profile._id, startsAt });
    res.status(201).json({ slot: { id: slot.id, startsAt: slot.startsAt } });
  } catch (error) {
    if (error.code === 11000) {
      return fail(
        res,
        409,
        "SLOT_EXISTS",
        "You already have a slot at that time.",
      );
    }

    throw error;
  }
});

router.get("/bookings", requireSession, async (req, res) => {
  const bookings = await Booking.find({ studentId: req.user._id })
    .sort({ createdAt: -1, _id: -1 })
    .populate({
      path: "slotId",
      select: "startsAt tutorId",
      populate: {
        path: "tutorId",
        select: "userId",
        populate: { path: "userId", select: "name" },
      },
    })
    .lean();

  res.json({
    bookings: bookings
      .filter((booking) => booking.slotId)
      .map((booking) => ({
        id: String(booking._id),
        startsAt: booking.slotId.startsAt,
        tutorName: booking.slotId.tutorId?.userId?.name ?? "Tutor",
        status: booking.status,
      })),
  });
});

router.post("/bookings", requireSession, async (req, res) => {
  const { tutorId, slotId } = req.body ?? {};

  if (!isId(tutorId) || !isId(slotId)) {
    return fail(
      res,
      400,
      "INVALID_BOOKING",
      "Choose a tutor and an available slot.",
    );
  }

  const [tutor, slot] = await Promise.all([
    TutorProfile.findOne({ _id: tutorId, verificationStatus: "verified" }),
    TutorSlot.findOne({
      _id: slotId,
      tutorId,
      cancelledAt: null,
      startsAt: { $gt: new Date() },
    }),
  ]);

  if (!tutor || !slot) {
    return fail(
      res,
      409,
      "SLOT_UNAVAILABLE",
      "This slot is no longer available.",
    );
  }

  if (tutor.userId.equals(req.user._id)) {
    return fail(
      res,
      400,
      "SELF_BOOKING",
      "Choose a slot offered by another tutor.",
    );
  }

  try {
    const booking = await Booking.create({
      slotId: slot._id,
      studentId: req.user._id,
      bookedRatePaise: tutor.hourlyRatePaise,
      status: "confirmed",
    });

    res
      .status(201)
      .json({ booking: { id: booking.id, status: booking.status } });
  } catch (error) {
    if (error.code === 11000) {
      return fail(
        res,
        409,
        "SLOT_UNAVAILABLE",
        "This slot is no longer available.",
      );
    }

    throw error;
  }
});

router.post("/bookings/:id/cancel", requireSession, async (req, res) => {
  const { id } = req.params;

  if (!isId(id)) {
    return fail(res, 404, "BOOKING_NOT_FOUND", "Booking not found.");
  }

  const booking = await Booking.findOne({
    _id: id,
    studentId: req.user._id,
  }).populate("slotId", "startsAt");

  if (!booking) {
    return fail(res, 404, "BOOKING_NOT_FOUND", "Booking not found.");
  }

  if (booking.status === "cancelled") {
    return res.status(204).end();
  }

  const now = new Date();

  if (!booking.slotId || booking.slotId.startsAt <= now) {
    return fail(
      res,
      409,
      "SESSION_STARTED",
      "This session can no longer be cancelled.",
    );
  }

  await Booking.updateOne(
    { _id: booking._id, studentId: req.user._id, status: "confirmed" },
    { $set: { status: "cancelled", cancelledAt: now } },
  );

  res.status(204).end();
});

export default router;
