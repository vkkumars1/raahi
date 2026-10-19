'use server'

import { bookRide } from '@/lib/api'

export async function createBooking(id: string, pickup: string, drop: string) {
  try { return { ok: true as const, booking: await bookRide(id, { pickup, drop }) } } catch (error) {
    const message = error instanceof Error ? error.message : 'This seat is no longer available.'
    return { ok: false as const, message }
  }
}
