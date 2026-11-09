import { randomBytes } from "node:crypto";
import { Router } from "express";
import { User } from "../models/User.js";
import { requireSession } from "../middleware/requireSession.js";
import { hashPassword, verifyPassword } from "../services/passwords.js";
import {
  clearSessionCookie,
  createSession,
  revokeSession,
} from "../services/sessions.js";

const router = Router();
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const dummyHash = await hashPassword(randomBytes(32).toString("hex"));

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };
}

function credentials(body) {
  const email =
    typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";

  const password = typeof body?.password === "string" ? body.password : "";

  return { email, password };
}

function validEmail(email) {
  return email.length <= 254 && emailPattern.test(email);
}

function sendError(res, status, code, message) {
  return res.status(status).json({ error: { code, message } });
}

router.use((_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

router.post("/register", async (req, res) => {
  const { email, password } = credentials(req.body);
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";

  if (
    name.length < 2 ||
    name.length > 80 ||
    !validEmail(email) ||
    password.length < 12 ||
    password.length > 128
  ) {
    return sendError(
      res,
      400,
      "INVALID_REGISTRATION",
      "Enter a name of 2–80 characters, a valid email, and a password of 12–128 characters.",
    );
  }

  const passwordHash = await hashPassword(password);

  let user;
  try {
    user = await User.create({ name, email, passwordHash });
  } catch (error) {
    if (error.code === 11000) {
      return sendError(
        res,
        409,
        "EMAIL_IN_USE",
        "This email is already registered. Sign in instead.",
      );
    }
    throw error;
  }

  await revokeSession(req.headers.cookie);
  await createSession(user.id, res);

  return res.status(201).json({ user: publicUser(user) });
});

router.post("/login", async (req, res) => {
  const { email, password } = credentials(req.body);

  if (!validEmail(email) || password.length === 0 || password.length > 128) {
    return sendError(
      res,
      400,
      "INVALID_LOGIN",
      "Enter a valid email and password.",
    );
  }

  const user = await User.findOne({ email }).select("+passwordHash");
  const matches = await verifyPassword(
    password,
    user?.passwordHash ?? dummyHash,
  );

  if (!user || !matches) {
    return sendError(
      res,
      401,
      "INVALID_CREDENTIALS",
      "Email or password is incorrect.",
    );
  }

  await revokeSession(req.headers.cookie);
  await createSession(user.id, res);

  return res.json({ user: publicUser(user) });
});

router.get("/me", requireSession, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

router.post("/logout", async (req, res) => {
  await revokeSession(req.headers.cookie);
  clearSessionCookie(res);
  res.status(204).end();
});

export default router;
