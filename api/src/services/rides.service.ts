import { pool, tx } from "../db/pool";
import { env } from "../config/env";
import { badRequest, conflict, forbidden, notFound } from "../lib/errors";
import { fareFor, scoreMatch } from "../lib/geo";
import { bookingsRepo } from "../repositories/bookings.repo";
import { messagesRepo } from "../repositories/messages.repo";
import { CreateRideInput, RideDto, ridesRepo } from "../repositories/rides.repo";
import { usersRepo } from "../repositories/users.repo";

/** A pickup/drop further than this from the host route is not a match. */
export const MAX_OFF_ROUTE_M = 1000;

export const ridesService = {
  async create(userId: string, input: Omit<CreateRideInput, "vehicleType"> & { vehicleType?: "car" | "bike" }) {
    const user = await usersRepo.findById(userId);
    if (!user) throw notFound("User not found");
    if (!user.onboarded) throw badRequest("Complete your profile before offering a ride", "not_onboarded");
    if (input.departTime.getTime() < Date.now() - 5 * 60_000) throw badRequest("Departure time is in the past");

    const id = await ridesRepo.create(userId, {
      ...input,
      vehicleType: input.vehicleType ?? user.vehicleType ?? "car",
    });
    return (await ridesRepo.findById(id))!;
  },

  async search(p: {
    userId?: string;
    pickup: { lat: number; lng: number };
    drop: { lat: number; lng: number };
    time: Date;
    windowMinutes: number;
  }) {
    const rows = await ridesRepo.findMatching({
      pickup: p.pickup,
      drop: p.drop,
      time: p.time,
      windowMinutes: p.windowMinutes,
      maxOffRouteM: MAX_OFF_ROUTE_M,
      excludeHostId: p.userId,
    });

    const results = rows.map((m) => ({
      ride: m.ride,
      matchPercent: scoreMatch({
        pickupOffRouteM: m.pickupOffRouteM,
        dropOffRouteM: m.dropOffRouteM,
        minutesApart: m.minutesApart,
        windowMinutes: p.windowMinutes,
        hostAvgRating: m.ride.host.avgRating,
        maxOffRouteM: MAX_OFF_ROUTE_M,
      }),
      fare: fareFor(m.segmentM, m.ride.pricePerKm), // what THIS guest pays
      segmentKm: Math.round(m.segmentM / 100) / 10,
      detourKm: Math.round(((m.pickupOffRouteM + m.dropOffRouteM) / 1000) * 10) / 10,
      minutesApart: Math.round(m.minutesApart),
    }));
    results.sort((a, b) => b.matchPercent - a.matchPercent);
    return results;
  },

  async get(rideId: string, viewerId?: string) {
    const ride = await ridesRepo.findById(rideId);
    if (!ride) throw notFound("Ride not found");
    if (!viewerId) return { ride };

    const member = await messagesRepo.isMember(rideId, viewerId);
    const myBooking = await pool
      .query(`SELECT id FROM bookings WHERE ride_id = $1 AND guest_id = $2`, [rideId, viewerId])
      .then((r) => r.rows[0]?.id as string | undefined);
    return {
      ride,
      isHost: ride.host.id === viewerId,
      myBooking: myBooking ? await bookingsRepo.findById(pool, myBooking) : null,
      participants: member ? await messagesRepo.participants(rideId) : undefined,
    };
  },

  async mine(hostId: string) {
    const rides = await ridesRepo.listByHost(hostId);
    const bookings = await bookingsRepo.listForRides(rides.map((r) => r.id));
    return rides.map((r) => ({ ...r, bookings: bookings.get(r.id) ?? [] }));
  },

  /** Host marks the trip done: ride + all confirmed bookings flip to completed atomically. */
  async complete(userId: string, rideId: string) {
    await tx(async (c) => {
      const ride = await ridesRepo.lockForBooking(c, rideId);
      if (!ride) throw notFound("Ride not found");
      if (ride.host_id !== userId) throw forbidden("Only the host can complete this ride");
      if (ride.status !== "scheduled") throw conflict("Ride is already closed", "ride_closed");
      await ridesRepo.markCompleted(c, rideId);
      await bookingsRepo.completeForRide(c, rideId);
    });
    return (await ridesRepo.findById(rideId))!;
  },
};

export type { RideDto };
export const _cabRate = () => env.CAB_RATE_PER_KM;
