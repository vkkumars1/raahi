#!/usr/bin/env node
/**
 * Raahi keep-alive pinger (zero dependencies, Node 18+).
 *
 *   BACKEND_URL=https://raahi-api.onrender.com FRONTEND_URL=https://raahi-ashy.vercel.app MODE=warm node scripts/keep-alive.mjs
 *
 * MODE=warm  -> GET /health            (keeps the Render free web service from spinning down)
 * MODE=deep  -> GET /health/deep       (also touches Postgres + Redis so Neon/Upstash see daily activity)
 *
 * The frontend (Vercel) is serverless and never sleeps; it is pinged too only to warm its cold start.
 * Exit code is 1 if the BACKEND could not be reached, so a scheduler (GitHub Actions) emails you.
 */
const BACKEND = process.env.BACKEND_URL?.replace(/\/$/, "");
const FRONTEND = process.env.FRONTEND_URL?.replace(/\/$/, "");
const MODE = process.env.MODE === "deep" ? "deep" : "warm";
const ATTEMPTS = 4;
const TIMEOUT_MS = 90_000; // a sleeping Render service can need ~60s to boot

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function ping(url) {
  for (let i = 1; i <= ATTEMPTS; i++) {
    const t0 = Date.now();
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), headers: { "user-agent": "raahi-keep-alive/1.0" } });
      console.log(`${new Date().toISOString()} ${url} -> ${res.status} in ${Date.now() - t0}ms (attempt ${i})`);
      if (res.ok) return true;
    } catch (e) {
      console.log(`${new Date().toISOString()} ${url} -> ${e.name}: ${e.message} (attempt ${i})`);
    }
    if (i < ATTEMPTS) await sleep(15_000 * i);
  }
  return false;
}

if (!BACKEND) {
  console.error("BACKEND_URL is required");
  process.exit(2);
}

const backendOk = await ping(`${BACKEND}${MODE === "deep" ? "/health/deep" : "/health"}`);
if (FRONTEND) await ping(`${FRONTEND}/api/health`); // best effort, never fails the job
process.exit(backendOk ? 0 : 1);
