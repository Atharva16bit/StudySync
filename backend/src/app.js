import { existsSync } from "node:fs";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import authRouter from "./routes/auth.js";
import groupsRouter from "./routes/groups.js";
import groupMembersRouter from "./routes/groupMembers.js";
import quizzesRouter from "./routes/quizzes.js";
import resourcesRouter from "./routes/resources.js";
import tutorsRouter from "./routes/tutors.js";

const app = express();

app.disable("x-powered-by");
app.use(express.json({ limit: "100kb" }));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "studysync-api" });
});

app.use("/api/auth", authRouter);
app.use("/api", tutorsRouter);
app.use("/api", quizzesRouter);
app.use("/api", resourcesRouter);
app.use("/api", groupMembersRouter);
app.use("/api", groupsRouter);

const frontendDist = fileURLToPath(
  new URL("../../frontend/dist/", import.meta.url),
);
const frontendIndex = join(frontendDist, "index.html");

if (existsSync(frontendIndex)) {
  app.get(/^\/(?!api(?:\/|$)|socket\.io(?:\/|$)).*$/i, [
    express.static(frontendDist),
    (req, res, next) => {
      if (
        /^\/assets(?:\/|$)/i.test(req.path) ||
        extname(req.path) ||
        !req.accepts("html")
      ) {
        return next();
      }

      return res.sendFile(frontendIndex, { cacheControl: false });
    },
  ]);
}

app.use((_req, res) => {
  res.status(404).json({
    error: {
      code: "NOT_FOUND",
      message: "The requested endpoint does not exist.",
    },
  });
});

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);

  if (error.type === "entity.parse.failed") {
    return res.status(400).json({
      error: {
        code: "INVALID_JSON",
        message: "Send a valid JSON request body.",
      },
    });
  }

  if (error.type === "entity.too.large") {
    return res.status(413).json({
      error: {
        code: "REQUEST_TOO_LARGE",
        message: "The request body is too large.",
      },
    });
  }

  console.error("API request failed", {
    method: req.method,
    route: req.route?.path ?? "unknown",
    name: error.name,
    code: error.code ?? error.Code,
    validationFields:
      error.name === "ValidationError" ? Object.keys(error.errors ?? {}) : [],
  });

  return res.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message: "Something went wrong. Please try again.",
    },
  });
});

export default app;
