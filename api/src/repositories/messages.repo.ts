import { pool } from "../db/pool";

export interface MessageDto {
  id: string;
  rideId: string;
  sender: { id: string; name: string | null };
  body: string;
  createdAt: string;
}

const map = (r: any): MessageDto => ({
  id: r.id,
  rideId: r.ride_id,
  sender: { id: r.sender_id, name: r.sender_name },
  body: r.body,
  createdAt: new Date(r.created_at).toISOString(),
});

export const messagesRepo = {
  /** Host or a guest with a confirmed/completed booking. */
  async isMember(rideId: string, userId: string): Promise<boolean> {
    const r = await pool.query(
      `SELECT 1 FROM rides r WHERE r.id = $1 AND (
         r.host_id = $2 OR EXISTS (
           SELECT 1 FROM bookings b WHERE b.ride_id = r.id AND b.guest_id = $2 AND b.status IN ('confirmed','completed')))`,
      [rideId, userId],
    );
    return (r.rowCount ?? 0) > 0;
  },

  async list(rideId: string, limit = 100): Promise<MessageDto[]> {
    const r = await pool.query(
      `SELECT * FROM (
         SELECT m.id, m.ride_id, m.sender_id, u.name AS sender_name, m.body, m.created_at
         FROM messages m JOIN users u ON u.id = m.sender_id
         WHERE m.ride_id = $1 ORDER BY m.created_at DESC LIMIT $2) t
       ORDER BY created_at ASC`,
      [rideId, limit],
    );
    return r.rows.map(map);
  },

  async insert(rideId: string, senderId: string, body: string): Promise<MessageDto> {
    const r = await pool.query(
      `WITH ins AS (INSERT INTO messages (ride_id, sender_id, body) VALUES ($1, $2, $3) RETURNING *)
       SELECT ins.id, ins.ride_id, ins.sender_id, u.name AS sender_name, ins.body, ins.created_at
       FROM ins JOIN users u ON u.id = ins.sender_id`,
      [rideId, senderId, body],
    );
    return map(r.rows[0]);
  },

  async participants(rideId: string): Promise<{ id: string; name: string | null; role: "host" | "guest" }[]> {
    const r = await pool.query(
      `SELECT u.id, u.name, 'host' AS role FROM rides r JOIN users u ON u.id = r.host_id WHERE r.id = $1
       UNION ALL
       SELECT u.id, u.name, 'guest' AS role FROM bookings b JOIN users u ON u.id = b.guest_id
       WHERE b.ride_id = $1 AND b.status IN ('confirmed','completed')`,
      [rideId],
    );
    return r.rows;
  },
};
