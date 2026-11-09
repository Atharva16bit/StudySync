import { createHash, randomBytes } from "node:crypto";
import { Router } from "express";
import mongoose from "mongoose";
import { requireSession } from "../middleware/requireSession.js";
import { Group } from "../models/Group.js";
import { Invite } from "../models/Invite.js";
import { Membership } from "../models/Membership.js";
import { User } from "../models/User.js";

const router = Router();
const inviteLifetimeMs = 7 * 24 * 60 * 60 * 1000;

function fail(res, status, code, message) {
  return res.status(status).json({ error: { code, message } });
}

function groupNotFound(res) {
  return fail(res, 404, "GROUP_NOT_FOUND", "Group not found.");
}

function inviteNotFound(res) {
  return fail(
    res,
    404,
    "INVITE_NOT_FOUND",
    "This invitation is invalid or expired.",
  );
}

function groupSummary(group) {
  return {
    id: String(group._id),
    name: group.name,
    description: group.description ?? "",
  };
}

function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

function parseGroupDetails(body) {
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const rawDescription = body?.description ?? "";

  if (typeof rawDescription !== "string") return null;

  const description = rawDescription.trim();

  if (name.length < 2 || name.length > 80 || description.length > 300) {
    return null;
  }

  return { name, description };
}

function invalidGroupDetails(res) {
  return fail(
    res,
    400,
    "INVALID_GROUP",
    "Enter a group name of 2–80 characters and a description of up to 300 characters.",
  );
}

function requireOwner(req, res, next) {
  if (req.groupRole !== "owner") {
    return fail(
      res,
      403,
      "OWNER_REQUIRED",
      "Only the group owner can do this.",
    );
  }

  next();
}

router.use("/groups", requireSession);
router.use("/invites", requireSession);

router.param("groupId", async (req, res, next, groupId) => {
  if (!mongoose.isObjectIdOrHexString(groupId)) {
    return groupNotFound(res);
  }

  const group = await Group.findOne({ _id: groupId, deletedAt: null });

  if (!group) return groupNotFound(res);

  const isOwner = group.ownerId.equals(req.user._id);

  if (!isOwner) {
    const membership = await Membership.exists({
      groupId: group._id,
      userId: req.user._id,
    });

    if (!membership) return groupNotFound(res);
  }

  req.studyGroup = group;
  req.groupRole = isOwner ? "owner" : "member";
  next();
});

router.get("/groups", async (req, res) => {
  const memberships = await Membership.find({ userId: req.user._id })
    .select("groupId")
    .lean();

  const groups = await Group.find({
    deletedAt: null,
    $or: [
      { ownerId: req.user._id },
      { _id: { $in: memberships.map((membership) => membership.groupId) } },
    ],
  }).sort({ createdAt: -1, _id: -1 });

  return res.json({ groups: groups.map(groupSummary) });
});

router.post("/groups", async (req, res) => {
  const details = parseGroupDetails(req.body);

  if (!details) return invalidGroupDetails(res);

  const group = await Group.create({
    ...details,
    ownerId: req.user._id,
  });

  return res.status(201).json({ group: groupSummary(group) });
});

router.get("/groups/:groupId", async (req, res) => {
  const group = req.studyGroup;
  const memberships = await Membership.find({ groupId: group._id })
    .select("userId")
    .lean();

  const users = await User.find({
    _id: {
      $in: [
        group.ownerId,
        ...memberships.map((membership) => membership.userId),
      ],
    },
  })
    .select("name")
    .sort({ name: 1, _id: 1 })
    .lean();

  return res.json({
    group: {
      ...groupSummary(group),
      role: req.groupRole,
      members: users.map((user) => ({
        id: String(user._id),
        name: user.name,
        role: group.ownerId.equals(user._id) ? "owner" : "member",
      })),
    },
  });
});

router.patch("/groups/:groupId", requireOwner, async (req, res) => {
  const details = parseGroupDetails(req.body);

  if (!details) return invalidGroupDetails(res);

  const group = await Group.findOneAndUpdate(
    {
      _id: req.studyGroup._id,
      ownerId: req.user._id,
      deletedAt: null,
    },
    { $set: details },
    { new: true, runValidators: true },
  );

  if (!group) return groupNotFound(res);

  return res.json({ group: groupSummary(group) });
});

router.delete("/groups/:groupId", requireOwner, async (req, res) => {
  await Group.updateOne(
    {
      _id: req.studyGroup._id,
      ownerId: req.user._id,
      deletedAt: null,
    },
    { $set: { deletedAt: new Date() } },
  );

  return res.status(204).end();
});

router.post("/groups/:groupId/invites", requireOwner, async (req, res) => {
  const token = randomBytes(32).toString("hex");

  await Invite.create({
    groupId: req.studyGroup._id,
    createdBy: req.user._id,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + inviteLifetimeMs),
  });

  res.set("Cache-Control", "no-store");
  return res.status(201).json({ token });
});

router.post("/invites/:token/accept", async (req, res) => {
  const { token } = req.params;

  if (!/^[a-f0-9]{64}$/.test(token)) return inviteNotFound(res);

  const invite = await Invite.findOne({
    tokenHash: hashToken(token),
    expiresAt: { $gt: new Date() },
    revokedAt: null,
  }).lean();

  if (!invite) return inviteNotFound(res);

  const group = await Group.findOne({
    _id: invite.groupId,
    deletedAt: null,
  });

  if (!group) return inviteNotFound(res);

  if (!group.ownerId.equals(req.user._id)) {
    const membership = {
      groupId: group._id,
      userId: req.user._id,
    };

    try {
      await Membership.updateOne(
        membership,
        { $setOnInsert: membership },
        { upsert: true },
      );
    } catch (error) {
      if (error.code !== 11000 || !(await Membership.exists(membership))) {
        throw error;
      }
    }
  }

  return res.json({ group: groupSummary(group) });
});

export default router;
