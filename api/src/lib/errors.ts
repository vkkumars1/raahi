export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
    public extra?: Record<string, unknown>,
  ) {
    super(message);
  }
}
export const badRequest = (m: string, code?: string) => new HttpError(400, m, code);
export const unauthorized = (m = "Please log in") => new HttpError(401, m, "unauthorized");
export const forbidden = (m = "Not allowed") => new HttpError(403, m, "forbidden");
export const notFound = (m = "Not found") => new HttpError(404, m, "not_found");
export const conflict = (m: string, code = "conflict") => new HttpError(409, m, code);
export const tooMany = (m: string, extra?: Record<string, unknown>) => new HttpError(429, m, "rate_limited", extra);
