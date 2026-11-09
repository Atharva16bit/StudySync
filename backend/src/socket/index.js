import { Server } from "socket.io";
import mongoose from "mongoose";
import { Group } from "../models/Group.js";
import { Membership } from "../models/Membership.js";
import { Message } from "../models/Message.js";
import { User } from "../models/User.js";
import { WhiteboardStroke } from "../models/WhiteboardStroke.js";
import { findSession } from "../services/sessions.js";

const clientIdPattern = /^[a-zA-Z0-9_-]{1,64}$/;
const colorPattern = /^#[a-fA-F0-9]{6}$/;

function publicMessage(message, senderName) {
  return {
    id: String(message._id),
    senderName,
    text: message.text,
  };
}

function publicStroke(stroke) {
  return {
    id: stroke.strokeId,
    color: stroke.color,
    width: stroke.width,
    points: stroke.points.map(({ x, y }) => ({ x, y })),
  };
}

function isValidStroke(stroke) {
  return (
    typeof stroke?.id === "string" &&
    clientIdPattern.test(stroke.id) &&
    typeof stroke.color === "string" &&
    colorPattern.test(stroke.color) &&
    Number.isFinite(stroke.width) &&
    stroke.width >= 1 &&
    stroke.width <= 20 &&
    Array.isArray(stroke.points) &&
    stroke.points.length >= 1 &&
    stroke.points.length <= 1000 &&
    stroke.points.every(
      (point) =>
        Number.isFinite(point?.x) &&
        Number.isFinite(point?.y) &&
        point.x >= 0 &&
        point.x <= 1 &&
        point.y >= 0 &&
        point.y <= 1,
    )
  );
}

async function canAccessGroup(groupId, userId) {
  if (typeof groupId !== "string" || !mongoose.isObjectIdOrHexString(groupId)) {
    return false;
  }

  const group = await Group.findOne({ _id: groupId, deletedAt: null }).select(
    "ownerId",
  );

  if (!group) return false;
  if (group.ownerId.equals(userId)) return true;

  return Boolean(await Membership.exists({ groupId, userId }));
}

export function attachStudySockets(httpServer) {
  const allowedOrigin = process.env.APP_ORIGIN || "http://localhost:5173";

  const io = new Server(httpServer, {
    maxHttpBufferSize: 128 * 1024,
    allowRequest(req, callback) {
      const origin = req.headers.origin;
      callback(null, !origin || origin === allowedOrigin);
    },
  });

  const roomQueues = new Map();

  function enqueue(room, task) {
    const previous = roomQueues.get(room) ?? Promise.resolve();
    const current = previous.catch(() => {}).then(task);
    roomQueues.set(room, current);

    function release() {
      if (roomQueues.get(room) === current) roomQueues.delete(room);
    }

    current.then(release, release);
    return current;
  }

  function roomMembers(room) {
    const members = new Map();

    for (const socketId of io.sockets.adapter.rooms.get(room) ?? []) {
      const socket = io.sockets.sockets.get(socketId);
      const user = socket?.data.user;

      if (user) members.set(user.id, user);
    }

    return [...members.values()];
  }

  function broadcastPresence(room) {
    io.to(room).emit("room:presence", roomMembers(room));
  }

  io.use(async (socket, next) => {
    try {
      const session = await findSession(socket.request.headers.cookie);
      const user = session
        ? await User.findById(session.userId).select("name")
        : null;

      if (!user) return next(new Error("Sign in to enter a study room."));

      socket.data.user = { id: user.id, name: user.name };
      next();
    } catch (error) {
      console.error("Socket authentication failed", error.name);
      next(new Error("Could not verify your session."));
    }
  });

  io.on("connection", (socket) => {
    const user = socket.data.user;

    function register(event, handler) {
      socket.on(event, async (payload, acknowledge) => {
        if (typeof acknowledge !== "function") return;

        const groupId = payload?.groupId;

        if (typeof groupId !== "string" || !/^[a-f0-9]{24}$/.test(groupId)) {
          return acknowledge({ ok: false, message: "Invalid group ID." });
        }

        const room = `study:${groupId}`;

        try {
          await enqueue(room, async () => {
            if (!socket.connected) return;

            const session = await findSession(socket.request.headers.cookie);

            if (!session || String(session.userId) !== user.id) {
              acknowledge({
                ok: false,
                message: "Your session expired. Sign in again.",
              });
              socket.disconnect(true);
              return;
            }

            if (!(await canAccessGroup(groupId, user.id))) {
              await socket.leave(room);
              broadcastPresence(room);

              return acknowledge({
                ok: false,
                message: "You do not have access to this group.",
              });
            }

            if (!socket.connected) return;

            if (event !== "room:join" && !socket.rooms.has(room)) {
              return acknowledge({
                ok: false,
                message: "Join the room first.",
              });
            }

            await handler({ payload, groupId, room, acknowledge });
          });
        } catch (error) {
          console.error("Study room event failed", {
            event,
            name: error.name,
            code: error.code,
          });

          acknowledge({
            ok: false,
            message: "The room could not save or load that update.",
          });
        }
      });
    }

    register("room:join", async ({ groupId, room, acknowledge }) => {
      const [messages, strokes] = await Promise.all([
        Message.find({ groupId })
          .sort({ createdAt: -1, _id: -1 })
          .limit(100)
          .lean(),
        WhiteboardStroke.find({ groupId })
          .sort({ createdAt: -1, _id: -1 })
          .limit(200)
          .lean(),
      ]);

      const senders = await User.find({
        _id: { $in: messages.map((message) => message.senderId) },
      })
        .select("name")
        .lean();

      const senderNames = new Map(
        senders.map((sender) => [String(sender._id), sender.name]),
      );

      if (!socket.connected) return;

      await socket.join(room);

      acknowledge({
        ok: true,
        messages: messages
          .reverse()
          .map((message) =>
            publicMessage(
              message,
              senderNames.get(String(message.senderId)) ?? "Former member",
            ),
          ),
        strokes: strokes.reverse().map(publicStroke),
        members: roomMembers(room),
      });

      broadcastPresence(room);
    });

    register("chat:send", async ({ payload, groupId, room, acknowledge }) => {
      const text = typeof payload.text === "string" ? payload.text.trim() : "";

      if (
        !text ||
        text.length > 1000 ||
        typeof payload.id !== "string" ||
        !clientIdPattern.test(payload.id)
      ) {
        return acknowledge({
          ok: false,
          message: "Enter a message of up to 1000 characters.",
        });
      }

      const key = { groupId, senderId: user.id, clientMessageId: payload.id };
      let message = await Message.findOne(key);
      const isNew = !message;

      if (isNew) {
        message = await Message.create({ ...key, text });
      }

      const item = publicMessage(message, user.name);
      acknowledge({ ok: true, item });

      if (isNew) socket.to(room).emit("chat:message", item);
    });

    register("board:draw", async ({ payload, groupId, room, acknowledge }) => {
      const stroke = payload.stroke;

      if (!isValidStroke(stroke)) {
        return acknowledge({
          ok: false,
          message: "Invalid whiteboard stroke.",
        });
      }

      const key = { groupId, strokeId: stroke.id };
      let saved = await WhiteboardStroke.findOne(key);
      const isNew = !saved;

      if (saved && String(saved.authorId) !== user.id) {
        return acknowledge({
          ok: false,
          message: "This stroke ID is already in use.",
        });
      }

      if (isNew) {
        saved = await WhiteboardStroke.create({
          ...key,
          authorId: user.id,
          color: stroke.color,
          width: stroke.width,
          points: stroke.points.map(({ x, y }) => ({ x, y })),
        });
      }

      const item = publicStroke(saved);
      acknowledge({ ok: true, item });

      if (isNew) socket.to(room).emit("board:stroke", item);
    });

    socket.on("disconnecting", () => {
      const rooms = [...socket.rooms].filter((room) =>
        room.startsWith("study:"),
      );
      queueMicrotask(() => rooms.forEach(broadcastPresence));
    });
  });

  return io;
}
