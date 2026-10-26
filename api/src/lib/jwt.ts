import jwt from "jsonwebtoken";
import { env } from "../config/env";

export const COOKIE_NAME = "raahi_token";
const TTL_SECONDS = 7 * 24 * 3600;
export const COOKIE_MAX_AGE_MS = TTL_SECONDS * 1000;

export const signToken = (userId: string, ttlSeconds = TTL_SECONDS) =>
  jwt.sign({ sub: userId }, env.JWT_SECRET, { expiresIn: ttlSeconds });

export function verifyToken(token: string): string | null {
  try {
    const p = jwt.verify(token, env.JWT_SECRET) as jwt.JwtPayload;
    return typeof p.sub === "string" ? p.sub : null;
  } catch {
    return null;
  }
}
