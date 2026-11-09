import http from "node:http";
import app from "./app.js";
import { connectDatabase } from "./config/database.js";
import { attachStudySockets } from "./socket/index.js";

const port = Number(process.env.PORT ?? 5000);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be an integer between 1 and 65535.");
}

const server = http.createServer(app);

server.on("error", (error) => {
  console.error("HTTP server failed:", error.code ?? error.name);
  process.exit(1);
});

async function startServer() {
  try {
    await connectDatabase();
    attachStudySockets(server);
  } catch (error) {
    console.error("Backend startup failed", {
      name: error.name,
      code: error.code,
    });
    process.exit(1);
  }

  server.listen(port, () => {
    console.log(
      `StudySync API and Socket.IO running at http://localhost:${port}`,
    );
  });
}

startServer();
