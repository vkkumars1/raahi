import { pool } from "../db/pool";

export const statsRepo = {
  async totals(userId: string, cabRatePerKm: number) {
    const r = await pool.query(
      `SELECT
         -- as guest
         COALESCE(SUM(GREATEST(0, b.distance_m / 1000 * $2 - b.fare)) FILTER (WHERE b.guest_id = $1), 0)::float AS saved,
         COALESCE(SUM(b.distance_m) FILTER (WHERE b.guest_id = $1), 0)::float AS guest_m,
         COUNT(*) FILTER (WHERE b.guest_id = $1)::int AS guest_rides,
         -- as host
         COALESCE(SUM(b.fare) FILTER (WHERE r.host_id = $1), 0)::float AS earned,
         COALESCE(SUM(b.distance_m) FILTER (WHERE r.host_id = $1), 0)::float AS host_m,
         COUNT(DISTINCT r.id) FILTER (WHERE r.host_id = $1)::int AS host_rides
       FROM bookings b JOIN rides r ON r.id = b.ride_id
       WHERE b.status = 'completed' AND (b.guest_id = $1 OR r.host_id = $1)`,
      [userId, cabRatePerKm],
    );
    return r.rows[0] as {
      saved: number; guest_m: number; guest_rides: number; earned: number; host_m: number; host_rides: number;
    };
  },

  async monthly(userId: string, cabRatePerKm: number) {
    const r = await pool.query(
      `SELECT to_char(m, 'YYYY-MM') AS month,
              COALESCE(SUM(GREATEST(0, b.distance_m / 1000 * $2 - b.fare)) FILTER (WHERE b.guest_id = $1), 0)::float AS saved,
              COALESCE(SUM(b.fare) FILTER (WHERE r.host_id = $1), 0)::float AS earned
       FROM generate_series(date_trunc('month', now()) - interval '5 months', date_trunc('month', now()), interval '1 month') m
       LEFT JOIN (bookings b JOIN rides r ON r.id = b.ride_id)
         ON b.status = 'completed'
        AND date_trunc('month', r.depart_time) = m
        AND (b.guest_id = $1 OR r.host_id = $1)
       GROUP BY m ORDER BY m`,
      [userId, cabRatePerKm],
    );
    return r.rows as { month: string; saved: number; earned: number }[];
  },
};
