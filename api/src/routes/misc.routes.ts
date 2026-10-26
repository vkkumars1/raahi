import { Readable } from "node:stream";
import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { env } from "../config/env";
import { pool } from "../db/pool";
import { kv } from "../lib/kv";
import { logger } from "../lib/logger";
import { optionalAuth, requireAuth } from "../middleware/auth";
import { asyncHandler } from "../middleware/error";
import { ratingsService } from "../services/ratings.service";
import { statsService } from "../services/stats.service";

const router = Router();

// ---------- health ----------
// Cheap: used by the frequent keep-warm ping (does not touch the DB).
router.get("/health", (_req, res) => res.json({ status: "ok", ts: Date.now() }));

// Deep: touches Postgres and Redis. Hit once a day so Neon/Upstash never see the project as idle.
router.get("/health/deep", async (_req, res) => {
  const out: Record<string, string> = {};
  try { await pool.query("SELECT 1"); out.postgres = "ok"; } catch { out.postgres = "down"; }
  try { out.redis = (await kv.ping()) ? "ok" : "down"; } catch { out.redis = "down"; }
  const ok = Object.values(out).every((v) => v === "ok");
  res.status(ok ? 200 : 503).json({ status: ok ? "ok" : "degraded", ...out, ts: Date.now() });
});

// ---------- ratings ----------
const ratingSchema = z.object({
  rideId: z.string().uuid(),
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().max(500).optional(),
  rateeId: z.string().uuid().optional(),
});
router.post("/ratings", requireAuth, asyncHandler(async (req, res) => {
  const b = ratingSchema.parse(req.body);
  res.status(201).json({ rating: await ratingsService.rate(req.userId!, b) });
}));

// ---------- dashboard ----------
router.get("/dashboard/stats", requireAuth, asyncHandler(async (req, res) => {
  res.json(await statsService.dashboard(req.userId!));
}));

// ---------- AI assistant proxy (FastAPI service) ----------
router.post("/ai/warmup", (_req, res) => {
  if (!env.AI_SERVICE_URL) return res.status(202).json({ status: "disabled" });
  // Fire and forget: a sleeping Render service needs up to ~60s to boot, the user should not wait for that.
  fetch(`${env.AI_SERVICE_URL}/health`, { signal: AbortSignal.timeout(90_000) }).catch(() => undefined);
  res.status(202).json({ status: "warming" });
});

const chatSchema = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(2000) }))
    .min(1)
    .max(20),
});
const aiLimiter = rateLimit({ windowMs: 60_000, limit: 20, standardHeaders: true, legacyHeaders: false });

router.post("/ai/chat", aiLimiter, optionalAuth, asyncHandler(async (req, res) => {
  if (!env.AI_SERVICE_URL) return res.status(503).json({ error: "Assistant is not enabled", code: "ai_disabled" });
  const body = chatSchema.parse(req.body);
  const ctrl = new AbortController();
  res.on("close", () => ctrl.abort());
  const upstream = await fetch(`${env.AI_SERVICE_URL}/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.any([ctrl.signal, AbortSignal.timeout(90_000)]),
  }).catch((e) => {
    logger.warn({ err: String(e) }, "ai service unreachable");
    return null;
  });
  if (!upstream || !upstream.ok || !upstream.body) {
    return res.status(502).json({ error: "Assistant is waking up, try again in a few seconds", code: "ai_unavailable" });
  }
  res.status(200);
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("X-Accel-Buffering", "no");
  Readable.fromWeb(upstream.body as any).pipe(res);
}));

export default router;
