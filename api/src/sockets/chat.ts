import cookie from "cookie";
import { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { allowedOrigins } from "../config/env";
import { COOKIE_NAME, verifyToken } from "../lib/jwt";
import { logger } from "../lib/logger";
import { usersRepo } from "../repositories/users.repo";
import { chatService } from "../services/chat.service";
import { messagesRepo } from "../repositories/messages.repo";
import { z } from "zod";

const roomOf = (rideId: string) => `ride:${rideId}`;
const idSchema = z.string().uuid();
const messageSchema = z.object({ rideId: idSchema, body: z.string().trim().min(1).max(1000) });
const typingSchema = z.object({ rideId: idSchema, isTyping: z.boolean() });

type Ack = (r: { ok: boolean; error?: string; [k: string]: unknown }) => void;

export function attachChat(http: HttpServer) {
  const io = new Server(http, {
    cors: { origin: allowedOrigins, credentials: true },
    pingInterval: 25_000,
  });

  // Auth on handshake: `auth.token` (Next.js passes it) or the httpOnly cookie.
  io.use((socket, next) => {
    const fromAuth = (socket.handshake.auth as { token?: string } | undefined)?.token;
    const fromCookie = cookie.parse(socket.handshake.headers.cookie ?? "")[COOKIE_NAME];
    const userId = verifyToken(fromAuth ?? fromCookie ?? "");
    if (!userId) return next(new Error("unauthorized"));
    socket.data.userId = userId;
    next();
  });

  io.on("connection", (socket) => {
    const userId: string = socket.data.userId;
    // IMPORTANT: register every handler synchronously. If we awaited anything before socket.on(...), an event the
    // client emits right after "connect" (e.g. join_ride) would arrive before the handler exists and be dropped.
    const namePromise = usersRepo.findById(userId).then((u) => u?.name ?? "Someone").catch(() => "Someone");
    let sent: number[] = []; // tiny per-socket flood guard: 20 msgs / 10 s

    // Only host + confirmed guests may join a ride room (checked in the DB, not trusted from the client).
    socket.on("join_ride", async (payload: unknown, ack?: Ack) => {
      try {
        const rideId = idSchema.parse(typeof payload === "string" ? payload : (payload as any)?.rideId);
        await chatService.assertMember(rideId, userId);
        await socket.join(roomOf(rideId));
        ack?.({ ok: true });
      } catch (e: any) {
        ack?.({ ok: false, error: e?.message ?? "Cannot join" });
      }
    });

    socket.on("message", async (payload: unknown, ack?: Ack) => {
      try {
        const { rideId, body } = messageSchema.parse(payload);
        if (!socket.rooms.has(roomOf(rideId))) throw new Error("Join the ride first");
        const now = Date.now();
        sent = sent.filter((t) => now - t < 10_000);
        if (sent.length >= 20) throw new Error("You are sending messages too fast");
        sent.push(now);

        const msg = await messagesRepo.insert(rideId, userId, body);
        io.to(roomOf(rideId)).emit("message", msg);
        ack?.({ ok: true, message: msg });
      } catch (e: any) {
        ack?.({ ok: false, error: e?.message ?? "Could not send" });
      }
    });

    socket.on("typing", async (payload: unknown) => {
      const p = typingSchema.safeParse(payload);
      if (!p.success || !socket.rooms.has(roomOf(p.data.rideId))) return;
      const name = await namePromise;
      socket.to(roomOf(p.data.rideId)).emit("typing", { rideId: p.data.rideId, userId, name, isTyping: p.data.isTyping });
    });

    socket.on("error", (e) => logger.warn({ err: String(e) }, "socket error"));
  });

  return io;
}
