import { env } from "../config/env";
import { CO2_KG_PER_KM } from "../lib/geo";
import { statsRepo } from "../repositories/stats.repo";
import { usersRepo } from "../repositories/users.repo";
import { ratingsRepo } from "../repositories/ratings.repo";
import { bookingsRepo } from "../repositories/bookings.repo";

const round = (n: number, d = 1) => Math.round(n * 10 ** d) / 10 ** d;

export const statsService = {
  async dashboard(userId: string) {
    const [t, monthly, profile] = await Promise.all([
      statsRepo.totals(userId, env.CAB_RATE_PER_KM),
      statsRepo.monthly(userId, env.CAB_RATE_PER_KM),
      usersRepo.findById(userId),
    ]);
    const sharedKm = (t.guest_m + t.host_m) / 1000;
    return {
      moneySaved: Math.round(t.saved), // vs. a solo cab at CAB_RATE_PER_KM
      moneyEarned: Math.round(t.earned),
      co2SavedKg: round(sharedKm * CO2_KG_PER_KM), // 0.12 kg per shared km
      ridesShared: t.guest_rides + t.host_rides,
      avgRating: profile?.avgRating ?? null,
      ratingCount: profile?.ratingCount ?? 0,
      trustScore: profile?.trustScore ?? 0,
      monthly: monthly.map((m) => ({ month: m.month, saved: Math.round(m.saved), earned: Math.round(m.earned) })),
    };
  },

  /** Past bookings + which ones still need a rating (drives the "Rate" button). */
  async myBookings(userId: string) {
    const [rows, rated] = await Promise.all([bookingsRepo.listForGuest(userId), ratingsRepo.ratedRideIds(userId)]);
    return rows.map(({ booking, ride }) => ({ ...booking, ride, rated: rated.has(ride.id) }));
  },
};
