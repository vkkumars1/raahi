import { pool, tx } from "../db/pool";
import { badRequest, conflict, notFound } from "../lib/errors";
import { fareFor } from "../lib/geo";
import { bookingsRepo } from "../repositories/bookings.repo";
import { ridesRepo } from "../repositories/rides.repo";
import { MAX_OFF_ROUTE_M } from "./rides.service";

interface Pt { label: string; lat: number; lng: number }

export const bookingService = {
  /**
   * Overbooking-proof booking.
   * `SELECT ... FOR UPDATE` takes a row lock on the ride, so concurrent bookings for the same ride queue up
   * and each one sees the real seats_left. Last seat => exactly one winner, the rest get 409 no_seats.
   */
  async book(guestId: string, rideId: string, pickup: Pt, dropoff: Pt) {
    const bookingId = await tx(async (c) => {
      const ride = await ridesRepo.lockForBooking(c, rideId);
      if (!ride) throw notFound("Ride not found");
      if (ride.host_id === guestId) throw badRequest("You cannot book your own ride", "own_ride");
      if (ride.status !== "scheduled") throw conflict("This ride is no longer open", "ride_closed");
      if (new Date(ride.depart_time).getTime() <= Date.now()) throw conflict("This ride has already departed", "ride_departed");
      if (await bookingsRepo.exists(c, rideId, guestId)) throw conflict("You already booked this ride", "already_booked");
      if (ride.seats_left <= 0) throw conflict("Sorry, the last seat was just taken", "no_seats");

      const seg = await bookingsRepo.segment(c, rideId, pickup, dropoff);
      if (seg.pm > MAX_OFF_ROUTE_M || seg.dm > MAX_OFF_ROUTE_M)
        throw badRequest("Pickup or drop is too far from this route", "off_route");
      if (!(seg.fp < seg.fd) || seg.seg_m <= 0)
        throw badRequest("Drop must come after pickup in the ride's direction", "wrong_direction");

      const fare = fareFor(seg.seg_m, ride.price_per_km);
      const id = await bookingsRepo.insert(c, { rideId, guestId, pickup, dropoff, distanceM: seg.seg_m, fare });
      if (!(await ridesRepo.decrementSeat(c, rideId))) throw conflict("Sorry, the last seat was just taken", "no_seats");
      return id;
    });
    return (await bookingsRepo.findById(pool, bookingId))!;
  },
};
