import { User } from "../models/User.js";
import { findSession } from "../services/sessions.js";

export async function requireSession(req, res, next) {
  const session = await findSession(req.headers.cookie);
  const user = session ? await User.findById(session.userId) : null;

  if (!user) {
    return res.status(401).json({
      error: {
        code: "AUTH_REQUIRED",
        message: "Sign in to continue.",
      },
    });
  }

  req.user = user;
  next();
}
