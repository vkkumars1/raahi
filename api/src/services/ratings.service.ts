import { pool } from "../db/pool";
import { badRequest, forbidden, notFound } from "../lib/errors";
import { ratingsRepo } from "../repositories/ratings.repo";

export const ratingsService = {
  /**
   * Guests rate the host. A host rates a specific guest by passing rateeId.
   * Only after the ride is completed, only by people who were on it, once per pair.
   */
  async rate(raterId: string, p: { rideId: string; rating: number; comment?: string; rateeId?: string }) {
    const ride = (await pool.query(`SELECT host_id, status FROM rides WHERE id = $1`, [p.rideId])).rows[0];
    if (!ride) throw notFound("Ride not found");
    if (ride.status !== "completed") throw badRequest("You can rate after the ride is completed", "ride_not_completed");

    let rateeId: string;
    if (raterId === ride.host_id) {
      if (!p.rateeId) throw badRequest("Hosts must say which guest they are rating (rateeId)");
      const ok = await pool.query(
        `SELECT 1 FROM bookings WHERE ride_id = $1 AND guest_id = $2 AND status = 'completed'`, [p.rideId, p.rateeId]);
      if (!ok.rowCount) throw badRequest("That user was not a guest on this ride");
      rateeId = p.rateeId;
    } else {
      const was = await pool.query(
        `SELECT 1 FROM bookings WHERE ride_id = $1 AND guest_id = $2 AND status = 'completed'`, [p.rideId, raterId]);
      if (!was.rowCount) throw forbidden("You were not a guest on this ride");
      rateeId = ride.host_id;
    }
    return ratingsRepo.insert({ rideId: p.rideId, raterId, rateeId, rating: p.rating, comment: p.comment });
  },
};
