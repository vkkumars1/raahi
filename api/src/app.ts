import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import pinoHttp from "pino-http";
import { allowedOrigins } from "./config/env";
import { logger } from "./lib/logger";
import { errorHandler, notFoundHandler } from "./middleware/error";
import routes from "./routes";

export function createApp() {
  const app = express();
  app.set("trust proxy", 1); // Render/Vercel sit behind a proxy: needed for correct client IPs
  app.disable("x-powered-by");

  app.use(pinoHttp({ logger, autoLogging: { ignore: (r) => r.url === "/health" } }));
  app.use(helmet());
  app.use(
    cors({
      origin: (origin, cb) => {
        // no Origin header = server-to-server (Next.js server, curl, GitHub Actions): allow
        if (!origin || allowedOrigins.includes(origin.replace(/\/$/, ""))) return cb(null, true);
        cb(new Error("CORS: origin not allowed"));
      },
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
  app.use(rateLimit({ windowMs: 15 * 60_000, limit: 600, standardHeaders: true, legacyHeaders: false, skip: (r) => r.path.startsWith("/health") }));

  app.use(routes);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
