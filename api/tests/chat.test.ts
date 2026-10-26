import http from "node:http";
import { AddressInfo } from "node:net";
import { io as connect, Socket } from "socket.io-client";
import { migrate } from "../src/db/migrate";
import { pool } from "../src/db/pool";
import { createApp } from "../src/app";
import { signToken } from "../src/lib/jwt";
import { attachChat } from "../src/sockets/chat";

let server: http.Server;
let url: string;
let dbUp = true;
const sockets: Socket[] = [];

const client = (token: string) => {
  const s = connect(url, { auth: { token }, transports: ["websocket"], reconnection: false });
  sockets.push(s);
  return s;
};
const emitAck = <T = any>(s: Socket, ev: string, payload: unknown) =>
  new Promise<T>((res) => s.emit(ev, payload, res));
const once = <T = any>(s: Socket, ev: string) => new Promise<T>((res) => s.once(ev, res));

let rideId: string, hostTok: string, guestTok: string, strangerTok: string;

beforeAll(async () => {
  try {
    await migrate();
    await pool.query("TRUNCATE users CASCADE");
  } catch { dbUp = false; return; }
  const mk = async (email: string, name: string) =>
    (await pool.query(`INSERT INTO users (email, name, role) VALUES ($1, $2, 'guest') RETURNING id`, [email, name])).rows[0].id as string;
  const [h, g, s] = [await mk("h@x.com", "Host"), await mk("g@x.com", "Guest"), await mk("s@x.com", "Stranger")];
  const ride = await pool.query(
    `INSERT INTO rides (host_id, origin_label, origin, destination_label, destination, route, route_length_m, depart_time, seats_total, seats_left, price_per_km)
     VALUES ($1,'A',ST_MakePoint(77.1,28.4)::geography,'B',ST_MakePoint(77.2,28.5)::geography,
             ST_GeogFromText('LINESTRING(77.1 28.4, 77.2 28.5)'), 15000, now() + interval '1 hour', 2, 1, 3) RETURNING id`, [h]);
  rideId = ride.rows[0].id;
  await pool.query(
    `INSERT INTO bookings (ride_id, guest_id, pickup_label, pickup, dropoff_label, dropoff, distance_m, fare)
     VALUES ($1,$2,'P',ST_MakePoint(77.1,28.4)::geography,'D',ST_MakePoint(77.2,28.5)::geography,15000,45)`, [rideId, g]);
  [hostTok, guestTok, strangerTok] = [signToken(h), signToken(g), signToken(s)];

  server = http.createServer(createApp());
  attachChat(server);
  await new Promise<void>((r) => server.listen(0, r));
  url = `http://localhost:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  sockets.forEach((s) => s.close());
  if (server) await new Promise((r) => server.close(r));
  await pool.end();
});

const maybe = (name: string, fn: () => Promise<void>) => it(name, async () => { if (dbUp) await fn(); });

describe("socket chat", () => {
  maybe("rejects connections without a valid token", async () => {
    const bad = connect(url, { auth: { token: "nope" }, transports: ["websocket"], reconnection: false });
    sockets.push(bad);
    const err = await once<Error>(bad, "connect_error");
    expect(err.message).toBe("unauthorized");
  });

  maybe("members join, exchange messages and see typing; strangers are refused", async () => {
    const host = client(hostTok), guest = client(guestTok), stranger = client(strangerTok);
    await Promise.all([once(host, "connect"), once(guest, "connect"), once(stranger, "connect")]);

    expect((await emitAck(stranger, "join_ride", { rideId })).ok).toBe(false);
    expect((await emitAck(host, "join_ride", { rideId })).ok).toBe(true);
    expect((await emitAck(guest, "join_ride", { rideId })).ok).toBe(true);

    // sending without joining is refused
    expect((await emitAck(stranger, "message", { rideId, body: "hi" })).ok).toBe(false);

    const incoming = once(host, "message");
    const ack = await emitAck(guest, "message", { rideId, body: "  On my way  " });
    expect(ack.ok).toBe(true);
    const msg = await incoming;
    expect(msg.body).toBe("On my way");
    expect(msg.sender.name).toBe("Guest");

    const typing = once(host, "typing");
    guest.emit("typing", { rideId, isTyping: true });
    expect(await typing).toMatchObject({ name: "Guest", isTyping: true });

    // persisted
    const rows = await pool.query("SELECT body FROM messages WHERE ride_id = $1", [rideId]);
    expect(rows.rows).toEqual([{ body: "On my way" }]);
  });
});
