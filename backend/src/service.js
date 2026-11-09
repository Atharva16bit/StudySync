import http from "node:http";
import app from "./app.js";

const port = Number(process.env.PORT ?? 5000);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be an integer between 1 and 65535.");
}

const server = http.createServer(app);

server.on("error", (error) => {
  console.error("Server failed:", error.message);
  process.exit(1);
});

server.listen(port, () => {
  console.log(`StudySync API running at http://localhost:${port}`);
});
