import { Router } from "express";
import mongoose from "mongoose";
import { requireSession } from "../middleware/requireSession.js";
import { Group } from "../models/Group.js";
import { Membership } from "../models/Membership.js";

const router = Router();

function fail(res, status, code, message) {
  return res.status(status).json({ error: { code, message } });
}

router.delete(
  "/groups/:groupId/members/:userId",
  requireSession,
  async (req, res) => {
    const { groupId, userId } = req.params;

    if (
      !mongoose.isObjectIdOrHexString(groupId) ||
      !mongoose.isObjectIdOrHexString(userId)
    ) {
      return fail(res, 400, "INVALID_ID", "Choose a valid group and member.");
    }

    const group = await Group.findOne({
      _id: groupId,
      deletedAt: null,
    }).select("ownerId");

    if (!group) {
      return fail(res, 404, "GROUP_NOT_FOUND", "Group not found.");
    }

    if (!group.ownerId.equals(req.user._id)) {
      return fail(
        res,
        403,
        "OWNER_REQUIRED",
        "Only the group owner can remove members.",
      );
    }

    if (group.ownerId.equals(userId)) {
      return fail(
        res,
        400,
        "CANNOT_REMOVE_OWNER",
        "The group owner cannot be removed.",
      );
    }

    await Membership.deleteOne({
      groupId: group._id,
      userId,
    });

    const io = req.app.get("studySockets");

    if (io) {
      const room = `study:${group.id}`;
      const memberId = userId.toLowerCase();

      for (const socket of await io.in(room).fetchSockets()) {
        if (socket.data.user?.id === memberId) {
          await socket.leave(room);
          socket.disconnect(true);
        }
      }

      const remaining = await io.in(room).fetchSockets();
      const members = new Map();

      for (const socket of remaining) {
        const user = socket.data.user;
        if (user) members.set(user.id, user);
      }

      io.to(room).emit("room:presence", [...members.values()]);
    }

    return res.status(204).end();
  },
);

export default router;
