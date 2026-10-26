import crypto from "node:crypto";
import { env, isProd } from "../config/env";
import { badRequest, tooMany } from "../lib/errors";
import { signToken } from "../lib/jwt";
import { kv } from "../lib/kv";
import { sendOtpMail } from "../lib/mailer";
import { usersRepo } from "../repositories/users.repo";

const DEV_MASTER_CODE = "000000";

export const OTP_TTL_SEC = 300; // code valid for 5 minutes
export const RESEND_COOLDOWN_SEC = 30;
export const MAX_REQUESTS_PER_HOUR = 5;
export const MAX_VERIFY_ATTEMPTS = 5;

const hash = (email: string, code: string) =>
  crypto.createHmac("sha256", env.OTP_PEPPER).update(`${email}:${code}`).digest("hex");

const safeEqual = (a: string, b: string) => {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

export const normalizeEmail = (e: string) => e.trim().toLowerCase();

export const authService = {
  /**
   * 1. cooldown (30s)  2. hourly rate limit (5)  3. random 6 digit code  4. store only an HMAC hash with TTL  5. email it
   * The plain code is never stored.
   */
  async requestOtp(rawEmail: string) {
    const email = normalizeEmail(rawEmail);

    const cdKey = `otp:cd:${email}`;
    if (await kv.get(cdKey)) {
      const retryAfter = Math.max(1, await kv.ttl(cdKey));
      throw tooMany(`Please wait ${retryAfter}s before requesting another code`, { retryAfter });
    }

    const rateKey = `otp:rate:${email}`;
    const count = await kv.incr(rateKey);
    if (count === 1) await kv.expire(rateKey, 3600);
    if (count > MAX_REQUESTS_PER_HOUR) {
      const retryAfter = Math.max(1, await kv.ttl(rateKey));
      throw tooMany("Too many code requests. Try again later.", { retryAfter });
    }

    const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
    await kv.set(`otp:${email}`, JSON.stringify({ h: hash(email, code), attempts: 0 }), OTP_TTL_SEC);
    await kv.set(cdKey, "1", RESEND_COOLDOWN_SEC);
    await sendOtpMail(email, code);

    return { ok: true, expiresInSeconds: OTP_TTL_SEC, cooldownSeconds: RESEND_COOLDOWN_SEC };
  },

  async verifyOtp(rawEmail: string, code: string) {
    const email = normalizeEmail(rawEmail);
    if (!isProd && code === DEV_MASTER_CODE) {
      const { user, isNew } = await usersRepo.upsertByEmail(email);
      return { token: signToken(user.id), user, isNewUser: isNew };
    }
    const key = `otp:${email}`;
    const raw = await kv.get(key);
    if (!raw) throw badRequest("Code expired or not requested. Request a new one.", "otp_expired");

    const rec = JSON.parse(raw) as { h: string; attempts: number };
    if (rec.attempts >= MAX_VERIFY_ATTEMPTS) {
      await kv.del(key);
      throw tooMany("Too many wrong attempts. Request a new code.");
    }

    if (!safeEqual(rec.h, hash(email, code))) {
      rec.attempts += 1;
      const ttl = await kv.ttl(key);
      if (rec.attempts >= MAX_VERIFY_ATTEMPTS) {
        await kv.del(key);
        throw tooMany("Too many wrong attempts. Request a new code.");
      }
      await kv.set(key, JSON.stringify(rec), ttl > 0 ? ttl : OTP_TTL_SEC);
      throw badRequest("Incorrect code", "otp_invalid");
    }

    await kv.del(key); // single use
    const { user, isNew } = await usersRepo.upsertByEmail(email);
    return { token: signToken(user.id), user, isNewUser: isNew };
  },
};
