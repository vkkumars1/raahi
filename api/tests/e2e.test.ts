/**
 * End-to-end test against a real PostGIS database (TEST_DATABASE_URL).
 * Covers: OTP login -> profile -> offer ride -> geospatial match -> book -> chat access -> complete -> rate -> stats,
 * plus the overbooking race (5 guests, 1 seat, exactly 1 winner).
 */
import request from "supertest";
import { migrate } from "../src/db/migrate";
import { pool } from "../src/db/pool";
import { createApp } from "../src/app";
import { signToken } from "../src/lib/jwt";

const sent: { to: string; code: string }[] = [];
jest.mock("../src/lib/mailer", () => ({ sendOtpMail: async (to: string, code: string) => void sent.push({ to, code }) }));

const app = createApp();

// Straight route Sector 56 -> Cyber Hub (Gurugram), 40 vertices, [lng, lat]
const A = { lng: 77.106, lat: 28.424 };
const B = { lng: 77.089, lat: 28.495 };
const coords: [number, number][] = Array.from({ length: 40 }, (_, i) => {
  const t = i / 39;
  return [A.lng + (B.lng - A.lng) * t, A.lat + (B.lat - A.lat) * t];
});
const at = (t: number) => ({ lng: A.lng + (B.lng - A.lng) * t, lat: A.lat + (B.lat - A.lat) * t });

let dbUp = true;
beforeAll(async () => {
  try {
    await migrate();
    await pool.query("TRUNCATE users CASCADE");
  } catch (e) {
    dbUp = false;
    console.warn("Skipping e2e: no PostGIS database available:", (e as Error).message);
  }
});
afterAll(() => pool.end());

const maybe = (name: string, fn: () => Promise<void>) => it(name, async () => { if (dbUp) await fn(); });

async function login(email: string) {
  await request(app).post("/auth/request-otp").send({ email }).expect(200);
  const code = sent.filter((s) => s.to === email).pop()!.code;
  const res = await request(app).post("/auth/verify-otp").send({ email, code }).expect(200);
  return { token: res.body.token as string, user: res.body.user };
}
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

describe("Raahi API flow", () => {
  let host: { token: string; user: any };
  let guest: { token: string; user: any };
  let rideId: string;
  const time = new Date(Date.now() + 2 * 3600_000);

  maybe("login, onboarding and profile", async () => {
    host = await login("host@example.com");
    expect(host.user.onboarded).toBe(false);
    const put = await request(app).put("/me").set(auth(host.token))
      .send({ name: "Aman Host", role: "host", vehicleType: "car", officeLocation: "Cyber Hub" }).expect(200);
    expect(put.body.user.onboarded).toBe(true);

    guest = await login("guest@example.com");
    await request(app).put("/me").set(auth(guest.token)).send({ name: "Neha Guest", role: "guest" }).expect(200);
    await request(app).get("/me").expect(401);
    const st = await request(app).post("/auth/socket-token").set(auth(host.token)).expect(200);
    expect(st.body.token).toBeTruthy();
    await request(app).get("/me").set(auth(st.body.token)).expect(200); // short-lived token is a valid JWT
    await request(app).post("/auth/socket-token").expect(401);
  });

  maybe("host offers a ride", async () => {
    const res = await request(app).post("/rides").set(auth(host.token)).send({
      origin: { label: "Sector 56", ...A }, destination: { label: "Cyber Hub", ...B },
      routeGeoJSON: { type: "LineString", coordinates: coords },
      departTime: time.toISOString(), seats: 2, pricePerKm: 3.5,
    }).expect(201);
    rideId = res.body.ride.id;
    expect(res.body.ride.distanceKm).toBeGreaterThan(7);
    expect(res.body.ride.seatsLeft).toBe(2);
  });

  const q = (p: { lat: number; lng: number }, d: { lat: number; lng: number }, extra = "") =>
    `/rides/search?pickupLat=${p.lat}&pickupLng=${p.lng}&dropLat=${d.lat}&dropLng=${d.lng}&time=${encodeURIComponent(time.toISOString())}&windowMinutes=30${extra}`;

  maybe("search matches by route overlap, direction and time", async () => {
    const pick = at(0.15), drop = at(0.85);
    const ok = await request(app).get(q(pick, drop)).set(auth(guest.token)).expect(200);
    expect(ok.body.count).toBe(1);
    const r = ok.body.results[0];
    expect(r.matchPercent).toBeGreaterThan(80);
    // guest rides ~70% of the route, so pays ~70% of the full fare, not the full fare
    const fullFare = Math.round(r.ride.distanceKm * 3.5);
    expect(r.fare).toBeLessThan(fullFare);
    expect(r.segmentKm).toBeGreaterThan(r.ride.distanceKm * 0.6);

    // opposite direction => pickup after drop along the route => no match
    expect((await request(app).get(q(drop, pick)).expect(200)).body.count).toBe(0);
    // far from the route => no match
    expect((await request(app).get(q({ lat: 28.6, lng: 77.3 }, drop)).expect(200)).body.count).toBe(0);
    // wrong time => no match
    const later = new Date(time.getTime() + 5 * 3600_000).toISOString();
    expect((await request(app).get(`/rides/search?pickupLat=${pick.lat}&pickupLng=${pick.lng}&dropLat=${drop.lat}&dropLng=${drop.lng}&time=${encodeURIComponent(later)}`).expect(200)).body.count).toBe(0);
    // host does not see own ride when logged in
    expect((await request(app).get(q(pick, drop)).set(auth(host.token)).expect(200)).body.count).toBe(0);
  });

  maybe("booking validates direction, blocks own ride and double booking", async () => {
    const pick = at(0.15), drop = at(0.85);
    const body = { pickup: { label: "P", ...pick }, drop: { label: "D", ...drop } };
    await request(app).post(`/rides/${rideId}/book`).set(auth(host.token)).send(body).expect(400);
    await request(app).post(`/rides/${rideId}/book`).set(auth(guest.token))
      .send({ pickup: body.drop, drop: body.pickup }).expect(400);
    const ok = await request(app).post(`/rides/${rideId}/book`).set(auth(guest.token)).send(body).expect(201);
    expect(ok.body.booking.fare).toBeGreaterThan(0);
    await request(app).post(`/rides/${rideId}/book`).set(auth(guest.token)).send(body).expect(409);
    const r = await request(app).get(`/rides/${rideId}`).set(auth(guest.token)).expect(200);
    expect(r.body.ride.seatsLeft).toBe(1);
    expect(r.body.participants).toHaveLength(2);
  });

  maybe("chat history is members only", async () => {
    await request(app).get(`/rides/${rideId}/messages`).set(auth(guest.token)).expect(200);
    const stranger = await login("stranger@example.com");
    await request(app).get(`/rides/${rideId}/messages`).set(auth(stranger.token)).expect(403);
  });

  maybe("complete, rate and dashboard stats", async () => {
    await request(app).post(`/rides/${rideId}/complete`).set(auth(guest.token)).expect(403);
    await request(app).post("/ratings").set(auth(guest.token)).send({ rideId, rating: 5 }).expect(400); // not completed yet
    await request(app).post(`/rides/${rideId}/complete`).set(auth(host.token)).expect(200);
    await request(app).post("/ratings").set(auth(guest.token)).send({ rideId, rating: 5, comment: "Smooth" }).expect(201);
    await request(app).post("/ratings").set(auth(guest.token)).send({ rideId, rating: 4 }).expect(409); // once only

    const g = await request(app).get("/dashboard/stats").set(auth(guest.token)).expect(200);
    expect(g.body.ridesShared).toBe(1);
    expect(g.body.moneySaved).toBeGreaterThan(0);
    expect(g.body.co2SavedKg).toBeGreaterThan(0);
    expect(g.body.monthly).toHaveLength(6);
    const h = await request(app).get("/dashboard/stats").set(auth(host.token)).expect(200);
    expect(h.body.moneyEarned).toBeGreaterThan(0);

    const hostMe = await request(app).get("/me").set(auth(host.token)).expect(200);
    expect(hostMe.body.user.avgRating).toBe(5);
    const bk = await request(app).get("/bookings/mine").set(auth(guest.token)).expect(200);
    expect(bk.body.bookings[0].rated).toBe(true);
  });

  maybe("overbooking race: 5 guests fight for the last seat, exactly one wins", async () => {
    const res = await request(app).post("/rides").set(auth(host.token)).send({
      origin: { label: "Sector 56", ...A }, destination: { label: "Cyber Hub", ...B },
      routeGeoJSON: { type: "LineString", coordinates: coords },
      departTime: new Date(Date.now() + 3 * 3600_000).toISOString(), seats: 1, pricePerKm: 3,
    }).expect(201);
    const id = res.body.ride.id;

    const tokens: string[] = [];
    for (let i = 0; i < 5; i++) {
      const u = await pool.query(`INSERT INTO users (email, name, role) VALUES ($1, $2, 'guest') RETURNING id`, [`racer${i}@example.com`, `Racer ${i}`]);
      tokens.push(signToken(u.rows[0].id));
    }
    const body = { pickup: { label: "P", ...at(0.1) }, drop: { label: "D", ...at(0.9) } };
    const out = await Promise.all(tokens.map((t) => request(app).post(`/rides/${id}/book`).set(auth(t)).send(body)));
    const statuses = out.map((o) => o.status).sort();
    expect(statuses).toEqual([201, 409, 409, 409, 409]);
    expect(out.filter((o) => o.status === 409).every((o) => o.body.code === "no_seats")).toBe(true);

    const row = await pool.query(`SELECT seats_left, (SELECT count(*) FROM bookings WHERE ride_id = $1)::int AS n FROM rides WHERE id = $1`, [id]);
    expect(row.rows[0]).toEqual({ seats_left: 0, n: 1 });
  });

  maybe("health endpoints", async () => {
    await request(app).get("/health").expect(200);
    const deep = await request(app).get("/health/deep").expect(200);
    expect(deep.body.postgres).toBe("ok");
  });
});
