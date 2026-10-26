# Connecting the v0 Next.js frontend

The API follows the contract you gave v0 (`/lib/api.ts`). If v0's generated types differ in field names, paste its `lib/api.ts` and align the Zod schemas to the response shapes in README.md.

## Env (Vercel + .env.local)
```
NEXT_PUBLIC_API_URL=https://raahi-api.onrender.com
```
Backend must list your Vercel URL in `FRONTEND_URL`.

## Session: keep the JWT in a cookie on YOUR domain
Frontend (vercel.app) and API (onrender.com) are different sites, so browsers can block the API's cookie. The reliable pattern is a tiny Next.js proxy that stores the token in an httpOnly cookie and forwards it as a Bearer header.

`app/api/auth/verify-otp/route.ts`
```ts
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const r = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/verify-otp`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(await req.json()),
  });
  const data = await r.json();
  if (!r.ok) return NextResponse.json(data, { status: r.status });
  (await cookies()).set("raahi_session", data.token, {
    httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 7 * 24 * 3600,
  });
  return NextResponse.json({ user: data.user, isNewUser: data.isNewUser });
}
```

`lib/server-api.ts` (use in server components and server actions)
```ts
import { cookies } from "next/headers";
const API = process.env.NEXT_PUBLIC_API_URL!;

export async function apiServer(path: string, init: RequestInit = {}) {
  const token = (await cookies()).get("raahi_session")?.value;
  return fetch(`${API}${path}`, {
    ...init,
    cache: "no-store",
    headers: { "content-type": "application/json", ...(init.headers ?? {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
}
```

`middleware.ts`: redirect to `/login` when the `raahi_session` cookie is missing for `/dashboard`, `/offer`, `/find/book`, `/chat`.

## Socket.io (browser)
The session cookie is httpOnly, so JS cannot read it. Ask your proxy for a 5 minute socket token:

`app/api/auth/socket-token/route.ts`
```ts
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
export async function POST() {
  const token = (await cookies()).get("raahi_session")?.value;
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const r = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/socket-token`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
  return NextResponse.json(await r.json(), { status: r.status });
}
```
```ts
const { token } = await (await fetch("/api/auth/socket-token", { method: "POST" })).json();
const socket = io(process.env.NEXT_PUBLIC_API_URL!, { auth: { token }, transports: ["websocket"] });
socket.emit("join_ride", { rideId }, (ack) => { /* ack.ok */ });
```

## Health route for the keep-alive ping
`app/api/health/route.ts`
```ts
export const dynamic = "force-dynamic";
export const GET = () => Response.json({ status: "ok", ts: Date.now() });
```

## AI assistant
- On first open: `fetch(`${API}/ai/warmup`, { method: "POST" })` (fire and forget).
- Then `fetch(`${API}/ai/chat`, { method: "POST", body: JSON.stringify({ messages }) })` and read `res.body` as a stream. If the text ends with a fenced ```json block `{"type":"rides","rides":[...]}`, strip it and render ticket cards.
