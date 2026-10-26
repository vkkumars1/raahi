import "dotenv/config";
import { z } from "zod";

const optional = z.string().optional().transform((v) => v || undefined);

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  REDIS_URL: optional,
  JWT_SECRET: z.string().min(16),
  OTP_PEPPER: z.string().min(16),
  FRONTEND_URL: z.string().default("http://localhost:3000"),
  SMTP_HOST: optional,
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: optional,
  SMTP_PASS: optional,
  MAIL_FROM: z.string().default("Raahi <no-reply@raahi.local>"),
  AI_SERVICE_URL: optional,
  CAB_RATE_PER_KM: z.coerce.number().default(20),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment variables:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export const allowedOrigins = env.FRONTEND_URL.split(",").map((s) => s.trim().replace(/\/$/, ""));
export const isProd = env.NODE_ENV === "production";
