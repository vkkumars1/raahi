import { Queryable, pool } from "../db/pool";
import { RideDto, mapRide } from "./rides.repo";

export interface BookingDto {
  id: string;
  rideId: string;
  guest: { id: string; name: string | null };
  pickup: { label: string; lat: number; lng: number };
  dropoff: { label: string; lat: number; lng: number };
  distanceKm: number;
  fare: number;
  status: "confirmed" | "cancelled" | "completed";
  createdAt: string;
}

const BOOKING_COLS = `
  b.id, b.ride_id, b.guest_id, g.name AS guest_name,
  b.pickup_label, ST_Y(b.pickup::geometry) AS pickup_lat, ST_X(b.pickup::geometry) AS pickup_lng,
  b.dropoff_label, ST_Y(b.dropoff::geometry) AS drop_lat, ST_X(b.dropoff::geometry) AS drop_lng,
  b.distance_m, b.fare::float AS fare, b.status, b.created_at`;

function mapBooking(r: any): BookingDto {
  return {
    id: r.id,
    rideId: r.ride_id,
    guest: { id: r.guest_id, name: r.guest_name },
    pickup: { label: r.pickup_label, lat: r.pickup_lat, lng: r.pickup_lng },
    dropoff: { label: r.dropoff_label, lat: r.drop_lat, lng: r.drop_lng },
    distanceKm: Math.round(r.distance_m / 100) / 10,
    fare: r.fare,
    status: r.status,
    createdAt: new Date(r.created_at).toISOString(),
  };
}

export const bookingsRepo = {
  async exists(db: Queryable, rideId: string, guestId: string) {
    const r = await db.query(`SELECT 1 FROM bookings WHERE ride_id=$1 AND guest_id=$2`, [rideId, guestId]);
    return (r.rowCount ?? 0) > 0;
  },

  /** Where does the guest's trip sit on the host's route, and how long is it? */
  async segment(
    db: Queryable,
    rideId: string,
    pickup: { lat: number; lng: number },
    drop: { lat: number; lng: number },
  ) {
    const r = await db.query(
      `WITH q AS (
         SELECT ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography AS p,
                ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography AS d
       ), x AS (
         SELECT r.route,
                ST_LineLocatePoint(r.route::geometry, q.p::geometry) AS fp,
                ST_LineLocatePoint(r.route::geometry, q.d::geometry) AS fd,
                ST_Distance(r.route, q.p) AS pm,
                ST_Distance(r.route, q.d) AS dm
         FROM rides r, q WHERE r.id = $5
       )
       SELECT fp, fd, pm, dm,
              CASE WHEN fp < fd THEN ST_Length(ST_LineSubstring(route::geometry, fp, fd)::geography) ELSE 0 END AS seg_m
       FROM x`,
      [pickup.lng, pickup.lat, drop.lng, drop.lat, rideId],
    );
    return r.rows[0] as { fp: number; fd: number; pm: number; dm: number; seg_m: number };
  },

  async insert(
    db: Queryable,
    b: {
      rideId: string;
      guestId: string;
      pickup: { label: string; lat: number; lng: number };
      dropoff: { label: string; lat: number; lng: number };
      distanceM: number;
      fare: number;
    },
  ): Promise<string> {
    const r = await db.query(
      `INSERT INTO bookings (ride_id, guest_id, pickup_label, pickup, dropoff_label, dropoff, distance_m, fare)
       VALUES ($1, $2, $3, ST_SetSRID(ST_MakePoint($4, $5), 4326)::geography,
               $6, ST_SetSRID(ST_MakePoint($7, $8), 4326)::geography, $9, $10)
       RETURNING id`,
      [b.rideId, b.guestId, b.pickup.label, b.pickup.lng, b.pickup.lat,
       b.dropoff.label, b.dropoff.lng, b.dropoff.lat, b.distanceM, b.fare],
    );
    return r.rows[0].id;
  },

  async findById(db: Queryable, id: string): Promise<BookingDto | null> {
    const r = await db.query(`SELECT ${BOOKING_COLS} FROM bookings b JOIN users g ON g.id = b.guest_id WHERE b.id = $1`, [id]);
    return r.rows[0] ? mapBooking(r.rows[0]) : null;
  },

  async listForRides(rideIds: string[]): Promise<Map<string, BookingDto[]>> {
    const out = new Map<string, BookingDto[]>();
    if (!rideIds.length) return out;
    const r = await pool.query(
      `SELECT ${BOOKING_COLS} FROM bookings b JOIN users g ON g.id = b.guest_id
       WHERE b.ride_id = ANY($1::uuid[]) AND b.status <> 'cancelled' ORDER BY b.created_at`,
      [rideIds],
    );
    for (const row of r.rows) {
      const list = out.get(row.ride_id) ?? [];
      list.push(mapBooking(row));
      out.set(row.ride_id, list);
    }
    return out;
  },

  async listForGuest(guestId: string): Promise<{ booking: BookingDto; ride: RideDto }[]> {
    // two light queries beats one monster join: reuse the ride mapper
    const b = await pool.query(
      `SELECT ${BOOKING_COLS} FROM bookings b JOIN users g ON g.id = b.guest_id
       WHERE b.guest_id = $1 ORDER BY b.created_at DESC LIMIT 100`,
      [guestId],
    );
    if (!b.rows.length) return [];
    const ids = [...new Set(b.rows.map((x) => x.ride_id))];
    const rides = await pool.query(
      `SELECT r.id, r.host_id, r.origin_label,
         ST_Y(r.origin::geometry) AS origin_lat, ST_X(r.origin::geometry) AS origin_lng,
         r.destination_label, ST_Y(r.destination::geometry) AS dest_lat, ST_X(r.destination::geometry) AS dest_lng,
         ST_AsGeoJSON(ST_Simplify(r.route::geometry, 0.00005))::json AS route,
         r.route_length_m, r.depart_time, r.seats_total, r.seats_left, r.vehicle_type,
         r.price_per_km::float AS price_per_km, r.status,
         h.name AS host_name, h.email_verified AS host_verified,
         ((SELECT count(*) FROM rides x WHERE x.host_id = h.id AND x.status = 'completed')
           + (SELECT count(*) FROM bookings k WHERE k.guest_id = h.id AND k.status = 'completed'))::int AS host_completed,
         (SELECT avg(rating) FROM ratings WHERE ratee_id = h.id)::float AS host_avg_rating,
         (SELECT count(*) FROM ratings WHERE ratee_id = h.id)::int AS host_rating_count
       FROM rides r JOIN users h ON h.id = r.host_id WHERE r.id = ANY($1::uuid[])`,
      [ids],
    );
    const byId = new Map(rides.rows.map((r) => [r.id, mapRide(r)]));
    return b.rows.map((row) => ({ booking: mapBooking(row), ride: byId.get(row.ride_id)! }));
  },

  async confirmedGuestIds(rideId: string): Promise<string[]> {
    const r = await pool.query(`SELECT guest_id FROM bookings WHERE ride_id = $1 AND status IN ('confirmed','completed')`, [rideId]);
    return r.rows.map((x) => x.guest_id);
  },

  async completeForRide(db: Queryable, rideId: string) {
    await db.query(`UPDATE bookings SET status = 'completed' WHERE ride_id = $1 AND status = 'confirmed'`, [rideId]);
  },
};
