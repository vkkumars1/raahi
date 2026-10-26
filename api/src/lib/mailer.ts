import nodemailer from "nodemailer";
import { env, isProd } from "../config/env";
import { logger } from "./logger";

const transport = env.SMTP_HOST
  ? nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    })
  : null;

export async function sendOtpMail(to: string, code: string) {
  if (!transport) {
    if (isProd) throw new Error("SMTP is not configured");
    logger.warn(`[DEV ONLY] OTP for ${to}: ${code}`);
    return;
  }
  await transport.sendMail({
    from: env.MAIL_FROM,
    to,
    subject: `Your Raahi code: ${code}`,
    text: `Your Raahi verification code is ${code}. It expires in 5 minutes.\n\nIf you did not request this, ignore this email.`,
    html: `<div style="font-family:Georgia,serif;max-width:420px">
      <h2 style="margin:0 0 8px">raahi.</h2>
      <p>Your verification code is</p>
      <p style="font-size:32px;letter-spacing:8px;font-family:monospace;margin:8px 0"><b>${code}</b></p>
      <p style="color:#555">Expires in 5 minutes. If you did not request this, ignore this email.</p></div>`,
  });
}
