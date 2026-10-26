import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { isProd } from "../config/env";
import { COOKIE_MAX_AGE_MS, COOKIE_NAME, signToken } from "../lib/jwt";
import { requireAuth } from "../middleware/auth";
import { asyncHandler } from "../middleware/error";
import { authService } from "../services/auth.service";

const router = Router();

const limiter = rateLimit({ windowMs: 15 * 60_000, limit: 40, standardHeaders: true, legacyHeaders: false });
const email = z.string().trim().email().max(254);

const cookieOpts = {
  httpOnly: true,
  secure: isProd,
  // frontend (vercel.app) and API (onrender.com) are different sites in production
  sameSite: (isProd ? "none" : "lax") as "none" | "lax",
  path: "/",
};

router.post("/auth/request-otp", limiter, asyncHandler(async (req, res) => {
  const { email: e } = z.object({ email }).parse(req.body);
  res.json(await authService.requestOtp(e));
}));

router.post("/auth/verify-otp", limiter, asyncHandler(async (req, res) => {
  const { email: e, code } = z.object({ email, code: z.string().regex(/^\d{6}$/, "Code must be 6 digits") }).parse(req.body);
  const out = await authService.verifyOtp(e, code);
  res.cookie(COOKIE_NAME, out.token, { ...cookieOpts, maxAge: COOKIE_MAX_AGE_MS });
  res.json(out); // token is also returned so the Next.js server can keep it in its own httpOnly cookie
}));

// Browsers cannot read the httpOnly session, so socket.io gets a 5 minute token used only for the handshake.
router.post("/auth/socket-token", requireAuth, (req, res) => {
  res.json({ token: signToken(req.userId!, 300), expiresInSeconds: 300 });
});

router.post("/auth/logout", (_req, res) => {
  res.clearCookie(COOKIE_NAME, cookieOpts);
  res.json({ ok: true });
});

export default router;
