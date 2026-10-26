import { Queryable, pool } from "../db/pool";
import { trustScore } from "../lib/geo";

export interface UserDto {
  id: string;
  email: string;
  name: string | null;
  role: "host" | "guest" | null;
  vehicleType: "car" | "bike" | null;
  officeLocation: string | null;
  onboarded: boolean;
  emailVerified: boolean;
  trustScore: number;
  avgRating: number | null;
  ratingCount: number;
}

const PROFILE_SQL = `
SELECT u.id, u.email::text AS email, u.name, u.role, u.vehicle_type, u.office_location, u.email_verified,
  ((SELECT count(*) FROM rides r WHERE r.host_id = u.id AND r.status = 'completed')
   + (SELECT count(*) FROM bookings b WHERE b.guest_id = u.id AND b.status = 'completed'))::int AS completed,
  (SELECT avg(rating) FROM ratings WHERE ratee_id = u.id)::float AS avg_rating,
  (SELECT count(*) FROM ratings WHERE ratee_id = u.id)::int AS rating_count
FROM users u`;

function toDto(r: any): UserDto {
  return {
    id: r.id,
    email: r.email,
    name: r.name,
    role: r.role,
    vehicleType: r.vehicle_type,
    officeLocation: r.office_location,
    onboarded: Boolean(r.name && r.role),
    emailVerified: r.email_verified,
    trustScore: trustScore(r.completed, r.avg_rating, r.email_verified),
    avgRating: r.avg_rating == null ? null : Math.round(r.avg_rating * 10) / 10,
    ratingCount: r.rating_count,
  };
}

export const usersRepo = {
  async upsertByEmail(email: string): Promise<{ user: UserDto; isNew: boolean }> {
    const ins = await pool.query(
      `INSERT INTO users (email) VALUES ($1) ON CONFLICT (email) DO NOTHING RETURNING id`,
      [email],
    );
    const row = await pool.query(`${PROFILE_SQL} WHERE u.email = $1`, [email]);
    return { user: toDto(row.rows[0]), isNew: ins.rowCount === 1 };
  },

  async findById(id: string, db: Queryable = pool): Promise<UserDto | null> {
    const r = await db.query(`${PROFILE_SQL} WHERE u.id = $1`, [id]);
    return r.rows[0] ? toDto(r.rows[0]) : null;
  },

  async updateProfile(
    id: string,
    p: { name: string; role: "host" | "guest"; vehicleType: "car" | "bike" | null; officeLocation: string | null },
  ) {
    await pool.query(
      `UPDATE users SET name=$2, role=$3, vehicle_type=$4, office_location=$5 WHERE id=$1`,
      [id, p.name, p.role, p.vehicleType, p.officeLocation],
    );
    return this.findById(id);
  },
};
