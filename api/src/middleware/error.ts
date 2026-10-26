import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { HttpError } from "../lib/errors";
import { logger } from "../lib/logger";

export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res, next).catch(next);

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ error: "Route not found", code: "not_found" });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: "Invalid input",
      code: "validation",
      details: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    });
  }
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, code: err.code, ...err.extra });
  }
  const pgCode = (err as { code?: string })?.code;
  if (pgCode === "23505") return res.status(409).json({ error: "Already exists", code: "duplicate" });
  if (pgCode === "23503") return res.status(404).json({ error: "Related record not found", code: "not_found" });
  logger.error({ err, path: req.path }, "unhandled error");
  res.status(500).json({ error: "Something went wrong", code: "internal" });
}
