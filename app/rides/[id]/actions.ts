'use server'

import { bookRide, type Place } from '@/lib/api'

export async function createBooking(id: string, pickup: Place, drop: Place) {
  try {
    return { ok: true as const, booking: await bookRide(id, { pickup, drop }) }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'This seat is no longer available.'
    return { ok: false as const, message }
  }
}
