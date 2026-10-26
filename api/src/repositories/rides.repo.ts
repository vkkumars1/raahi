import { Queryable, pool } from "../db/pool";
import { trustScore } from "../lib/geo";

/** Columns + host stats joined for every ride payload. Route is simplified (~5 m) to keep responses small. */
const RIDE_COLS = `
  r.id, r.host_id, r.origin_label,
  ST_Y(r.origin::geometry) AS origin_lat, ST_X(r.origin::geometry) AS origin_lng,
  r.destination_label,
  ST_Y(r.destination::geometry) AS dest_lat, ST_X(r.destination::geometry) AS dest_lng,
  ST_AsGeoJSON(ST_Simplify(r.route::geometry, 0.00005))::json AS route,
  r.route_length_m, r.depart_time, r.seats_total, r.seats_left, r.vehicle_type,
  r.price_per_km::float AS price_per_km, r.status,
  h.name AS host_name, h.email_verified AS host_verified,
  hs.completed AS host_completed, hs.avg_rating AS host_avg_rating, hs.rating_count AS host_rating_count`;

const HOST_JOIN = `
  JOIN users h ON h.id = r.host_id
  LEFT JOIN LATERAL (
    SELECT
      ((SELECT count(*) FROM rides x WHERE x.host_id = h.id AND x.status = 'completed')
       + (SELECT count(*) FROM bookings b WHERE b.guest_id = h.id AND b.status = 'completed'))::int AS completed,
      (SELECT avg(rating) FROM ratings WHERE ratee_id = h.id)::float AS avg_rating,
      (SELECT count(*) FROM ratings WHERE ratee_id = h.id)::int AS rating_count
  ) hs ON true`;

export interface RideDto {
  id: string;
  host: { id: string; name: string | null; verified: boolean; trustScore: number; avgRating: number | null; ratingCount: number };
  origin: { label: string; lat: number; lng: number };
  destination: { label: string; lat: number; lng: number };
  route: { type: "LineString"; coordinates: [number, number][] };
  distanceKm: number;
  departTime: string;
  seatsTotal: number;
  seatsLeft: number;
  vehicleType: "car" | "bike";
  pricePerKm: number;
  status: "scheduled" | "completed" | "cancelled";
}

export function mapRide(r: any): RideDto {
  const avg = r.host_avg_rating == null ? null : Math.round(r.host_avg_rating * 10) / 10;
  return {
    id: r.id,
    host: {
      id: r.host_id,
      name: r.host_name,
      verified: r.host_verified,
      trustScore: trustScore(r.host_completed, r.host_avg_rating, r.host_verified),
      avgRating: avg,
      ratingCount: r.host_rating_count,
    },
    origin: { label: r.origin_label, lat: r.origin_lat, lng: r.origin_lng },
    destination: { label: r.destination_label, lat: r.dest_lat, lng: r.dest_lng },
    route: r.route,
    distanceKm: Math.round(r.route_length_m / 100) / 10,
    departTime: new Date(r.depart_time).toISOString(),
    seatsTotal: r.seats_total,
    seatsLeft: r.seats_left,
    vehicleType: r.vehicle_type,
    pricePerKm: r.price_per_km,
    status: r.status,
  };
}

export interface CreateRideInput {
  origin: { label: string; lat: number; lng: number };
  destination: { label: string; lat: number; lng: number };
  routeGeoJSON: { type: "LineString"; coordinates: [number, number][] };
  departTime: Date;
  seats: number;
  pricePerKm: number;
  vehicleType: "car" | "bike";
}

export interface MatchRow {
  ride: RideDto;
  pickupOffRouteM: number;
  dropOffRouteM: number;
  segmentM: number;
  minutesApart: number;
}

export const ridesRepo = {
  async create(hostId: string, i: CreateRideInput): Promise<string> {
    const r = await pool.query(
      `WITH g AS (SELECT ST_SetSRID(ST_GeomFromGeoJSON($8::text), 4326)::geography AS route)
       INSERT INTO rides (host_id, origin_label, origin, destination_label, destination, route, route_length_m,
                          depart_time, seats_total, seats_left, vehicle_type, price_per_km)
       SELECT $1, $2, ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography,
              $5, ST_SetSRID(ST_MakePoint($6, $7), 4326)::geography,
              g.route, ST_Length(g.route), $9, $10, $10, $11, $12
       FROM g RETURNING id`,
      [
        hostId, i.origin.label, i.origin.lng, i.origin.lat,
        i.destination.label, i.destination.lng, i.destination.lat,
        JSON.stringify(i.routeGeoJSON), i.departTime, i.seats, i.vehicleType, i.pricePerKm,
      ],
    );
    return r.rows[0].id;
  },

  async findById(id: string, db: Queryable = pool): Promise<RideDto | null> {
    const r = await db.query(`SELECT ${RIDE_COLS} FROM rides r ${HOST_JOIN} WHERE r.id = $1`, [id]);
    return r.rows[0] ? mapRide(r.rows[0]) : null;
  },

  async listByHost(hostId: string): Promise<RideDto[]> {
    const r = await pool.query(
      `SELECT ${RIDE_COLS} FROM rides r ${HOST_JOIN} WHERE r.host_id = $1 ORDER BY r.depart_time DESC LIMIT 100`,
      [hostId],
    );
    return r.rows.map(mapRide);
  },

  /**
   * THE MATCHING QUERY.
   * A ride matches when ALL of these hold:
   *  1. status scheduled, has seats, departs inside [t - window, t + window] and is still in the future
   *  2. pickup AND drop are within `maxOffRouteM` metres of the host's route (GiST-backed ST_DWithin)
   *  3. pickup comes BEFORE drop along the direction of travel (ST_LineLocatePoint fraction compare)
   * The guest's travelled segment is cut out with ST_LineSubstring so we can price only that part.
   */
  async findMatching(p: {
    pickup: { lat: number; lng: number };
    drop: { lat: number; lng: number };
    time: Date;
    windowMinutes: number;
    maxOffRouteM: number;
    excludeHostId?: string;
  }): Promise<MatchRow[]> {
    const r = await pool.query(
      `WITH q AS (
         SELECT ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography AS pickup,
                ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography AS dropoff,
                $5::timestamptz AS t, $6::int AS win
       ), cand AS (
         SELECT r.id,
                ST_LineLocatePoint(r.route::geometry, q.pickup::geometry)  AS f_pick,
                ST_LineLocatePoint(r.route::geometry, q.dropoff::geometry) AS f_drop,
                ST_Distance(r.route, q.pickup)  AS pick_m,
                ST_Distance(r.route, q.dropoff) AS drop_m
         FROM rides r, q
         WHERE r.status = 'scheduled'
           AND r.seats_left > 0
           AND r.depart_time > now()
           AND r.depart_time BETWEEN q.t - make_interval(mins => q.win) AND q.t + make_interval(mins => q.win)
           AND ST_DWithin(r.route, q.pickup,  $7)
           AND ST_DWithin(r.route, q.dropoff, $7)
           AND ($8::uuid IS NULL OR r.host_id <> $8::uuid)
       )
       SELECT ${RIDE_COLS},
              c.pick_m, c.drop_m,
              ST_Length(ST_LineSubstring(r.route::geometry, c.f_pick, c.f_drop)::geography) AS seg_m,
              EXTRACT(EPOCH FROM (r.depart_time - q.t)) / 60 AS minutes_diff
       FROM cand c
       JOIN rides r ON r.id = c.id
       CROSS JOIN q
       ${HOST_JOIN}
       WHERE c.f_pick < c.f_drop
       ORDER BY (c.pick_m + c.drop_m) ASC
       LIMIT 50`,
      [p.pickup.lng, p.pickup.lat, p.drop.lng, p.drop.lat, p.time, p.windowMinutes, p.maxOffRouteM, p.excludeHostId ?? null],
    );
    return r.rows.map((row) => ({
      ride: mapRide(row),
      pickupOffRouteM: row.pick_m,
      dropOffRouteM: row.drop_m,
      segmentM: row.seg_m,
      minutesApart: Math.abs(row.minutes_diff),
    }));
  },

  /** Row lock: serialises concurrent bookings on the same ride (prevents overbooking). */
  async lockForBooking(db: Queryable, id: string) {
    const r = await db.query(
      `SELECT id, host_id, status, seats_left, price_per_km::float AS price_per_km, depart_time
       FROM rides WHERE id = $1 FOR UPDATE`,
      [id],
    );
    return r.rows[0] as
      | { id: string; host_id: string; status: string; seats_left: number; price_per_km: number; depart_time: Date }
      | undefined;
  },

  async decrementSeat(db: Queryable, id: string) {
    const r = await db.query(`UPDATE rides SET seats_left = seats_left - 1 WHERE id = $1 AND seats_left > 0`, [id]);
    return r.rowCount === 1;
  },

  async markCompleted(db: Queryable, id: string) {
    await db.query(`UPDATE rides SET status = 'completed' WHERE id = $1`, [id]);
  },
};
