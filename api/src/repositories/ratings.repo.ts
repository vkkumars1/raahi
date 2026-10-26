import { pool } from "../db/pool";

export const ratingsRepo = {
  async insert(r: { rideId: string; raterId: string; rateeId: string; rating: number; comment?: string | null }) {
    const res = await pool.query(
      `INSERT INTO ratings (ride_id, rater_id, ratee_id, rating, comment) VALUES ($1,$2,$3,$4,$5)
       RETURNING id, ride_id, ratee_id, rating, comment, created_at`,
      [r.rideId, r.raterId, r.rateeId, r.rating, r.comment ?? null],
    );
    const x = res.rows[0];
    return { id: x.id, rideId: x.ride_id, rateeId: x.ratee_id, rating: x.rating, comment: x.comment, createdAt: x.created_at };
  },

  /** Rides the user finished that they have not rated yet (drives the "Rate" button). */
  async ratedRideIds(raterId: string): Promise<Set<string>> {
    const r = await pool.query(`SELECT DISTINCT ride_id FROM ratings WHERE rater_id = $1`, [raterId]);
    return new Set(r.rows.map((x) => x.ride_id));
  },
};
