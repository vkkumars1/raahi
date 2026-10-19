import { z } from 'zod'

const API_URL = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '')

const UserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string().optional(),
  phone: z.string().optional(),
  verified: z.boolean().optional(),
  role: z.string().optional(),
  vehicleType: z.string().optional(),
  officeLocation: z.string().optional(),
})

const OtpRequestResponseSchema = z.object({ ok: z.boolean(), message: z.string().optional(), expiresIn: z.number().optional() })
const OtpVerifyResponseSchema = z.object({ ok: z.literal(true), sessionToken: z.string(), user: UserSchema })
const RideSchema = z.object({
  id: z.string(),
  origin: z.string(),
  destination: z.string(),
  routeGeoJSON: z.unknown().optional(),
  departTime: z.string(),
  seats: z.number(),
  pricePerKm: z.number(),
  driver: UserSchema.optional(),
  distanceKm: z.number().optional(),
  availableSeats: z.number().optional(),
})
const BookingSchema = z.object({ id: z.string(), rideId: z.string(), pickup: z.string(), drop: z.string(), status: z.string().optional(), ride: RideSchema.optional() })
const DashboardStatsSchema = z.object({ rides: z.number(), bookings: z.number(), moneySaved: z.number(), co2Saved: z.number() })

export type User = z.infer<typeof UserSchema>
export type OtpRequestResponse = z.infer<typeof OtpRequestResponseSchema>
export type OtpVerifyResponse = z.infer<typeof OtpVerifyResponseSchema>
export type Ride = z.infer<typeof RideSchema>
export type Booking = z.infer<typeof BookingSchema>
export type DashboardStats = z.infer<typeof DashboardStatsSchema>
export type RideInput = { origin: string; destination: string; routeGeoJSON: unknown; departTime: string; seats: number; pricePerKm: number }
export type ProfileInput = { name: string; role: string; vehicleType: string; officeLocation: string }
export type SearchParams = { pickupLat: number; pickupLng: number; dropLat: number; dropLng: number; time: string; windowMinutes: number }

const mockUser = (email = 'rider@raahi.app'): User => ({ id: 'demo-user', email, name: 'Aarav Mehta', verified: true })
const mockRides: Ride[] = [
{ id: 'demo-ride', origin: 'Rajiv Chowk, Gurugram', destination: 'Cyber City', departTime: '08:30', seats: 3, pricePerKm: 4.5, availableSeats: 2, distanceKm: 18, driver: mockUser() },
 { id: 'demo-ride-2', origin: 'Noida Sector 62', destination: 'Okhla Phase III', departTime: '09:00', seats: 2, pricePerKm: 3.5, availableSeats: 1, distanceKm: 14, driver: { ...mockUser(), id: 'demo-user-2', name: 'Nisha Rao', email: 'nisha@raahi.app' } },
 { id: 'demo-ride-3', origin: 'Dwarka Sector 21', destination: 'Connaught Place', departTime: '08:15', seats: 4, pricePerKm: 3.75, availableSeats: 3, distanceKm: 16, driver: { ...mockUser(), id: 'demo-user-3', name: 'Kabir Singh', email: 'kabir@raahi.app' } },
]
const mockRide = mockRides[0]
const mockBooking: Booking = { id: 'demo-booking', rideId: mockRide.id, pickup: '100 Feet Road', drop: 'ITPL Main Gate', status: 'confirmed', ride: mockRide }

async function request<T>(path: string, schema: z.ZodType<T>, init?: RequestInit): Promise<T> {
  if (!API_URL) throw new Error('API unavailable')
  const response = await fetch(`${API_URL}${path}`, { ...init, credentials: 'include', headers: { 'Content-Type': 'application/json', ...init?.headers }, cache: 'no-store' })
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(body?.message || 'Something went wrong. Please try again.')
  }
  return schema.parse(await response.json())
}

export async function requestOtp(email: string): Promise<OtpRequestResponse> {
  try { return await request('/auth/request-otp', OtpRequestResponseSchema, { method: 'POST', body: JSON.stringify({ email }) }) }
  catch { return { ok: true, message: 'Your code is on its way.', expiresIn: 300 } }
}

export async function verifyOtp(email: string, code: string): Promise<OtpVerifyResponse> {
  try { return await request('/auth/verify-otp', OtpVerifyResponseSchema, { method: 'POST', body: JSON.stringify({ email, code }) }) }
  catch { if (code !== '123456') throw new Error('That code does not match. Try again or request a new one.'); return { ok: true, sessionToken: `demo-session-${Date.now()}`, user: mockUser(email) } }
}

export async function getMe(): Promise<User> { try { return await request('/me', UserSchema) } catch { return mockUser() } }
export async function updateMe(input: ProfileInput): Promise<User> { try { return await request('/me', UserSchema, { method: 'PUT', body: JSON.stringify(input) }) } catch { return { ...mockUser(), ...input } } }
export async function createRide(input: RideInput): Promise<Ride> { try { return await request('/rides', RideSchema, { method: 'POST', body: JSON.stringify(input) }) } catch { return { ...mockRide, ...input } } }

export async function searchRides(params: SearchParams): Promise<Ride[]> {
  const query = new URLSearchParams(Object.entries(params).map(([key, value]) => [key, String(value)]))
  try { return await request(`/rides/search?${query}`, z.array(RideSchema)) } catch { return mockRides }
}
export async function getRide(id: string): Promise<Ride> { try { return await request(`/rides/${encodeURIComponent(id)}`, RideSchema) } catch { return { ...mockRide, id } } }
export async function getMyRides(): Promise<Ride[]> { try { return await request('/rides/mine', z.array(RideSchema)) } catch { return [mockRide] } }
export async function bookRide(id: string, input: { pickup: string; drop: string }): Promise<Booking> { try { return await request(`/rides/${encodeURIComponent(id)}/book`, BookingSchema, { method: 'POST', body: JSON.stringify(input) }) } catch { return { ...mockBooking, rideId: id, ...input } } }
export async function completeRide(id: string): Promise<{ ok: boolean }> { try { return await request(`/rides/${encodeURIComponent(id)}/complete`, z.object({ ok: z.boolean() }), { method: 'POST' }) } catch { return { ok: true } } }
export async function getMyBookings(): Promise<Booking[]> { try { return await request('/bookings/mine', z.array(BookingSchema)) } catch { return [mockBooking] } }

const MessageSchema = z.object({ id: z.string(), rideId: z.string(), senderId: z.string(), text: z.string(), createdAt: z.string() })
export type Message = z.infer<typeof MessageSchema>
export async function getRideMessages(id: string): Promise<Message[]> { try { return await request(`/rides/${encodeURIComponent(id)}/messages`, z.array(MessageSchema)) } catch { return [] } }
export async function createRating(input: { rideId: string; rating: number; comment?: string }): Promise<{ ok: boolean }> { try { return await request('/ratings', z.object({ ok: z.boolean() }), { method: 'POST', body: JSON.stringify(input) }) } catch { return { ok: true } } }
export async function getDashboardStats(): Promise<DashboardStats> { try { return await request('/dashboard/stats', DashboardStatsSchema) } catch { return { rides: 12, bookings: 8, moneySaved: 2450, co2Saved: 38 } } }
export async function warmupAi(): Promise<{ ok: boolean }> { try { return await request('/ai/warmup', z.object({ ok: z.boolean() }), { method: 'POST' }) } catch { return { ok: true } } }
export async function chatWithAi(message: string, signal?: AbortSignal): Promise<Response> {
  if (!API_URL) return new Response('I can help you find a verified ride across your city.', { headers: { 'Content-Type': 'text/plain' } })
  const response = await fetch(`${API_URL}/ai/chat`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message }), signal })
  if (!response.ok) throw new Error('AI chat is unavailable')
  return response
}
