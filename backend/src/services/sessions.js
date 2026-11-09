import { createHash, randomBytes } from "node:crypto";
import { Session } from "../models/Session.js";

const cookieName = "studysync_session";
const sessionDurationMs = 7 * 24 * 60 * 60 * 1000;

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  };
}

function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

function readSessionToken(cookieHeader = "") {
  for (const part of cookieHeader.split(";")) {
    const [name, value] = part.trim().split("=", 2);

    if (name === cookieName && /^[a-f0-9]{64}$/.test(value ?? "")) {
      return value;
    }
  }

  return null;
}

export async function createSession(userId, res) {
  const token = randomBytes(32).toString("hex");

  await Session.create({
    userId,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + sessionDurationMs),
  });

  res.cookie(cookieName, token, {
    ...cookieOptions(),
    maxAge: sessionDurationMs,
  });
}

export async function findSession(cookieHeader) {
  const token = readSessionToken(cookieHeader);
  if (!token) return null;

  return Session.findOne({
    tokenHash: hashToken(token),
    expiresAt: { $gt: new Date() },
  });
}

export async function revokeSession(cookieHeader) {
  const token = readSessionToken(cookieHeader);

  if (token) {
    await Session.deleteOne({ tokenHash: hashToken(token) });
  }
}

export function clearSessionCookie(res) {
  res.clearCookie(cookieName, cookieOptions());
}
