import http from "node:http";
import { createApp } from "./app";
import { env } from "./config/env";
import { pool } from "./db/pool";
import { logger } from "./lib/logger";
import { attachChat } from "./sockets/chat";

const app = createApp();
const server = http.createServer(app);
const io = attachChat(server);

server.listen(env.PORT, () => logger.info(`Raahi API listening on :${env.PORT}`));

const shutdown = (sig: string) => {
  logger.info(`${sig} received, shutting down`);
  io.close();
  server.close(async () => {
    await pool.end().catch(() => undefined);
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
};
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
