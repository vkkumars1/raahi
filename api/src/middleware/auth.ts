import { NextFunction, Request, Response } from "express";
import { COOKIE_NAME, verifyToken } from "../lib/jwt";
import { unauthorized } from "../lib/errors";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

/** Accepts `Authorization: Bearer <jwt>` (used by the Next.js server proxy) or the httpOnly cookie. */
export function extractToken(req: Pick<Request, "headers" | "cookies">): string | null {
  const h = req.headers.authorization;
  if (h?.startsWith("Bearer ")) return h.slice(7);
  return req.cookies?.[COOKIE_NAME] ?? null;
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const t = extractToken(req);
  if (t) req.userId = verifyToken(t) ?? undefined;
  next();
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const t = extractToken(req);
  const id = t ? verifyToken(t) : null;
  if (!id) return next(unauthorized());
  req.userId = id;
  next();
}
