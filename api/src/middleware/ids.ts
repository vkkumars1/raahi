import { z } from "zod";
import { notFound } from "../lib/errors";

const uuid = z.string().uuid();
/** Invalid ids are simply "not found" (avoids leaking pg errors for malformed uuids). */
export function parseId(raw: unknown): string {
  const r = uuid.safeParse(raw);
  if (!r.success) throw notFound();
  return r.data;
}
