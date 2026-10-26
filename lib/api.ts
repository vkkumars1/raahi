import { z } from 'zod'

const API_URL = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') ?? ''

const PlaceSchema = z.object({ label: z.string(), lat: z.number(), lng: z.number() })

const RawUserSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string().nullable().optional(),
  role: z.string().nullable().optional(),
  vehicleType: z.string().nullable().optional(),
  officeLocation: PlaceSchema.nullable().optional(),
  trustScore: z.number().optional(),
  createdAt: z.string().optional(),
})

const RawRideSchema = z.object({
  id: z.string(),
  host: z.object({ id: z.string(), name: z.string().nullable().optional(), trustScore: z.number().optional() }).passthrough().optional(),
  origin: PlaceSchema,
  destination: PlaceSchema,
  departTime: z.string(),
  seats: z.number().optional(),
  seatsTotal: z.number().optional(),
  seatsLeft: z.number().optional(),
  pricePerKm: z.number(),
  distanceKm: z.number().optional(),
  vehicleType: z.string().nullable().optional(),
  status: z.string().optional(),
  route: z.any().optional(),
  routeGeoJSON: z.any().optional(),
}).passthrough()

const RawBookingSchema = z.object({
  id: z.string(),
  rideId: z.string(),
  pickup: PlaceSchema,
  drop: PlaceSchema.optional(),
  dropoff: PlaceSchema.optional(),
  fare: z.number().optional(),
  segmentKm: z.number().optional(),
  distanceKm: z.number().optional(),
  status: z.string().optional(),
  createdAt: z.string().optional(),
  ride: RawRideSchema.optional(),
  rated: z.boolean().optional(),
}).passthrough()

const RawSearchSchema = z.object({
  ride: RawRideSchema,
  matchPercent: z.number(),
  fare: z.number(),
  segmentKm: z.number(),
  detourKm: z.number().optional(),
  minutesApart: z.number().optional(),
})

const RawMessageSchema = z.object({
  id: z.string(),
  rideId: z.string(),
  senderId: z.string(),
  body: z.string(),
  createdAt: z.string(),
  sender: z.object({ id: z.string(), name: z.string().nullable().optional() }).optional(),
})

const RawDashboardSchema = z.object({
  moneySaved: z.number(),
  moneyEarned: z.number(),
  co2SavedKg: z.number(),
  ridesShared: z.number(),
  avgRating: z.number().nullable().optional(),
  trustScore: z.number(),
  monthly: z.array(z.object({ month: z.string() }).passthrough()).optional(),
}).passthrough()

const OtpRequestResponseSchema = z.object({
  ok: z.boolean(),
  expiresInSeconds: z.number().optional(),
  cooldownSeconds: z.number().optional(),
})

const OtpVerifyResponseSchema = z.object({
  user: RawUserSchema,
  isNewUser: z.boolean().optional(),
})

export type Place = z.infer<typeof PlaceSchema>

export type User = {
  id: string
  email: string
  name?: string
  role?: string
  vehicleType?: string
  officeLocation?: Place | string
  trustScore?: number
  verified?: boolean
  phone?: string
}

export type Ride = {
  id: string
  origin: string
  destination: string
  originPlace: Place
  destinationPlace: Place
  departTime: string
  seats: number
  seatsLeft: number
  availableSeats: number
  pricePerKm: number
  distanceKm?: number
  vehicleType?: string
  status?: string
  host?: { id: string; name?: string; trustScore?: number }
  driver?: { id: string; name?: string; email: string; verified: boolean }
  route?: unknown
  routeGeoJSON?: unknown
  bookings?: Booking[]
  isHost?: boolean
  myBooking?: Booking
  participants?: Array<{ id: string; name?: string }>
}

export type Booking = {
  id: string
  rideId: string
  pickup: string
  drop: string
  pickupPlace: Place
  dropPlace: Place
  fare?: number
  segmentKm?: number
  status?: string
  createdAt?: string
  ride?: Ride
  rated?: boolean
}

export type SearchResult = {
  ride: Ride
  matchPercent: number
  fare: number
  segmentKm: number
  detourKm?: number
  minutesApart?: number
}

export type Message = {
  id: string
  rideId: string
  senderId: string
  body: string
  text: string
  createdAt: string
  sender?: { id: string; name?: string }
}

export type DashboardStats = {
  moneySaved: number
  moneyEarned: number
  co2SavedKg: number
  co2Saved: number
  ridesShared: number
  rides: number
  bookings: number
  avgRating: number | null
  trustScore: number
  monthly?: Array<{ month: string; rides?: number; saved?: number; earned?: number }>
}

export type OtpRequestResponse = {
  ok: boolean
  message?: string
  expiresIn?: number
  expiresInSeconds?: number
  cooldownSeconds?: number
}

export type OtpVerifyResponse = { ok: true; sessionToken: string; user: User; isNewUser?: boolean }

export type ProfileInput = {
  name: string
  role: 'host' | 'guest' | string
  vehicleType?: string
  officeLocation?: Place | string
}

export type RideInput = {
  origin: Place | string
  destination: Place | string
  routeGeoJSON: unknown
  departTime: string
  seats: number
  pricePerKm: number
  vehicleType?: string
}

export type SearchParams = {
  pickupLat: number
  pickupLng: number
  dropLat: number
  dropLng: number
  time: string
  windowMinutes?: number
}

export type BookInput = { pickup: Place | string; drop: Place | string }

export class ApiError extends Error {
  code?: string
  status: number
  retryAfter?: number
  payload: Record<string, unknown>
  constructor(message: string, status: number, payload: Record<string, unknown> = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = payload.code as string | undefined
    this.retryAfter = payload.retryAfter as number | undefined
    this.payload = payload
  }
}

type RawUser = z.infer<typeof RawUserSchema>
type RawRide = z.infer<typeof RawRideSchema>
type RawBooking = z.infer<typeof RawBookingSchema>
type RawMessage = z.infer<typeof RawMessageSchema>

function toUser(raw: RawUser): User {
  return {
    id: raw.id,
    email: raw.email,
    name: raw.name ?? undefined,
    role: raw.role ?? undefined,
    vehicleType: raw.vehicleType ?? undefined,
    officeLocation: raw.officeLocation ?? undefined,
    trustScore: raw.trustScore,
    verified: true,
  }
}

function toRide(raw: RawRide): Ride {
  const seats = raw.seats ?? raw.seatsTotal ?? 0
  const seatsLeft = raw.seatsLeft ?? seats
  return {
    id: raw.id,
    origin: raw.origin.label,
    destination: raw.destination.label,
    originPlace: raw.origin,
    destinationPlace: raw.destination,
    departTime: raw.departTime,
    seats,
    seatsLeft,
    availableSeats: seatsLeft,
    pricePerKm: raw.pricePerKm,
    distanceKm: raw.distanceKm,
    vehicleType: raw.vehicleType ?? undefined,
    status: raw.status,
    host: raw.host ? { id: raw.host.id, name: raw.host.name ?? undefined, trustScore: raw.host.trustScore } : undefined,
    driver: raw.host ? { id: raw.host.id, name: raw.host.name ?? undefined, email: '', verified: true } : undefined,
    route: raw.route,
    routeGeoJSON: raw.routeGeoJSON ?? raw.route,
  }
}

function toBooking(raw: RawBooking): Booking {
  const dropPlace = raw.drop ?? raw.dropoff ?? { label: 'Drop', lat: 0, lng: 0 }
  return {
    id: raw.id,
    rideId: raw.rideId,
    pickup: raw.pickup.label,
    drop: dropPlace.label,
    pickupPlace: raw.pickup,
    dropPlace,
    fare: raw.fare,
    segmentKm: raw.segmentKm ?? raw.distanceKm,
    status: raw.status,
    createdAt: raw.createdAt,
    ride: raw.ride ? toRide(raw.ride) : undefined,
    rated: raw.rated,
  }
}

function toMessage(raw: RawMessage): Message {
  return {
    id: raw.id,
    rideId: raw.rideId,
    senderId: raw.senderId,
    body: raw.body,
    text: raw.body,
    createdAt: raw.createdAt,
    sender: raw.sender ? { id: raw.sender.id, name: raw.sender.name ?? undefined } : undefined,
  }
}

function toPlace(input: Place | string | undefined, fallback = 'Unknown'): Place {
  if (!input) return { label: fallback, lat: 0, lng: 0 }
  if (typeof input === 'string') return { label: input, lat: 0, lng: 0 }
  return input
}

async function request<T>(path: string, schema: z.ZodType<T>, init?: RequestInit): Promise<T> {
  if (!API_URL) throw new ApiError('API not configured', 500, { code: 'no_api_url' })
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
    cache: 'no-store',
  })
  const text = await response.text()
  let data: unknown = null
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = { raw: text }
    }
  }
  if (!response.ok) {
    const payload = (data as Record<string, unknown>) ?? {}
    throw new ApiError(
      typeof payload.error === 'string' ? payload.error : response.statusText,
      response.status,
      payload,
    )
  }
  return schema.parse(data)
}

export async function requestOtp(email: string): Promise<OtpRequestResponse> {
  const raw = await request('/auth/request-otp', OtpRequestResponseSchema, {
    method: 'POST',
    body: JSON.stringify({ email }),
  })
  return { ...raw, message: 'Your six-digit code is on its way.', expiresIn: raw.expiresInSeconds }
}

export async function verifyOtp(email: string, code: string): Promise<OtpVerifyResponse> {
  const response = await fetch('/api/auth/verify-otp', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, code }),
  })
  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>
  if (!response.ok) throw new ApiError((data.error as string) ?? 'Verification failed', response.status, data)
  const parsed = OtpVerifyResponseSchema.parse(data)
  return { ok: true, sessionToken: 'cookie', user: toUser(parsed.user), isNewUser: parsed.isNewUser }
}

export async function logout(): Promise<void> {
  await fetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined)
}

export async function getMe(): Promise<User> {
  const data = await request('/me', z.object({ user: RawUserSchema }))
  return toUser(data.user)
}

export async function updateMe(input: ProfileInput): Promise<User> {
  const body: Record<string, unknown> = { name: input.name, role: input.role, vehicleType: input.vehicleType }
  if (input.officeLocation) {
    body.officeLocation = typeof input.officeLocation === 'string' ? input.officeLocation : input.officeLocation.label
  }
  const data = await request('/me', z.object({ user: RawUserSchema }), {
    method: 'PUT',
    body: JSON.stringify(body),
  })
  return toUser(data.user)
}

export async function createRide(input: RideInput): Promise<Ride> {
  const body = {
    origin: toPlace(input.origin, 'Origin'),
    destination: toPlace(input.destination, 'Destination'),
    routeGeoJSON: input.routeGeoJSON,
    departTime: input.departTime,
    seats: input.seats,
    pricePerKm: input.pricePerKm,
    vehicleType: input.vehicleType,
  }
  const data = await request('/rides', z.object({ ride: RawRideSchema }), {
    method: 'POST',
    body: JSON.stringify(body),
  })
  return toRide(data.ride)
}

export async function searchRides(params: SearchParams): Promise<Ride[]> {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => v !== undefined && query.set(k, String(v)))
  const data = await request(`/rides/search?${query}`, z.object({ results: z.array(RawSearchSchema), count: z.number().optional() }))
  return data.results.map((r) => ({ ...toRide(r.ride), distanceKm: r.segmentKm }))
}

export async function searchRidesDetailed(params: SearchParams): Promise<SearchResult[]> {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => v !== undefined && query.set(k, String(v)))
  const data = await request(`/rides/search?${query}`, z.object({ results: z.array(RawSearchSchema), count: z.number().optional() }))
  return data.results.map((r) => ({ ride: toRide(r.ride), matchPercent: r.matchPercent, fare: r.fare, segmentKm: r.segmentKm, detourKm: r.detourKm, minutesApart: r.minutesApart }))
}

export async function getRide(id: string): Promise<Ride> {
  const data = await request(`/rides/${encodeURIComponent(id)}`, z.object({
    ride: RawRideSchema,
    isHost: z.boolean().optional(),
    myBooking: RawBookingSchema.optional(),
    participants: z.array(z.object({ id: z.string(), name: z.string().nullable().optional() })).optional(),
  }))
  const ride = toRide(data.ride)
  ride.isHost = data.isHost
  ride.myBooking = data.myBooking ? toBooking(data.myBooking) : undefined
  ride.participants = data.participants?.map((p) => ({ id: p.id, name: p.name ?? undefined }))
  return ride
}

export async function getMyRides(): Promise<Ride[]> {
  const data = await request('/rides/mine', z.object({ rides: z.array(RawRideSchema.extend({ bookings: z.array(RawBookingSchema).optional() })) }))
  return data.rides.map((r) => {
    const ride = toRide(r)
    ride.bookings = r.bookings?.map(toBooking)
    return ride
  })
}

export async function bookRide(id: string, input: BookInput): Promise<Booking> {
  const body = { pickup: toPlace(input.pickup, 'Pickup'), drop: toPlace(input.drop, 'Drop') }
  const data = await request(`/rides/${encodeURIComponent(id)}/book`, z.object({ booking: RawBookingSchema }), {
    method: 'POST',
    body: JSON.stringify(body),
  })
  return toBooking(data.booking)
}

export async function completeRide(id: string): Promise<Ride> {
  const data = await request(`/rides/${encodeURIComponent(id)}/complete`, z.object({ ride: RawRideSchema }), { method: 'POST' })
  return toRide(data.ride)
}

export async function getRideMessages(id: string): Promise<Message[]> {
  const data = await request(`/rides/${encodeURIComponent(id)}/messages`, z.object({ messages: z.array(RawMessageSchema) }))
  return data.messages.map(toMessage)
}

export async function getMyBookings(): Promise<Booking[]> {
  const data = await request('/bookings/mine', z.object({ bookings: z.array(RawBookingSchema) }))
  return data.bookings.map(toBooking)
}

export async function createRating(input: { rideId: string; rating: number; comment?: string; rateeId?: string }): Promise<{ ok: true }> {
  await request('/ratings', z.object({ rating: z.any() }).passthrough(), { method: 'POST', body: JSON.stringify(input) })
  return { ok: true }
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const raw = await request('/dashboard/stats', RawDashboardSchema)
  return {
    ...raw,
    avgRating: raw.avgRating ?? null,
    co2Saved: raw.co2SavedKg,
    rides: raw.ridesShared,
    bookings: raw.ridesShared,
  }
}

export async function warmupAi(): Promise<{ ok: true }> {
  if (!API_URL) return { ok: true }
  await fetch(`${API_URL}/ai/warmup`, { method: 'POST' }).catch(() => undefined)
  return { ok: true }
}

export async function chatWithAi(
  messages: string | Array<{ role: 'user' | 'assistant'; content: string }>,
  signal?: AbortSignal,
): Promise<Response> {
  if (!API_URL) throw new ApiError('AI not configured', 500, { code: 'no_api_url' })
  const payload = typeof messages === 'string' ? [{ role: 'user' as const, content: messages }] : messages
  const response = await fetch(`${API_URL}/ai/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ messages: payload }),
    signal,
  })
  if (!response.ok) throw new ApiError('AI chat is unavailable', response.status)
  return response
}

export function friendlyError(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.code) {
      case 'no_seats': return 'The last seat was just booked. Try another ride.'
      case 'already_booked': return 'You already booked a seat on this ride.'
      case 'ride_closed': return 'This ride is no longer accepting bookings.'
      case 'off_route': return 'Pickup or drop is too far from the host route.'
      case 'wrong_direction': return 'Pickup must come before drop along the route.'
      case 'rate_limited': return error.retryAfter ? `Too many requests. Try again in ${error.retryAfter}s.` : 'Too many requests, slow down a bit.'
      case 'invalid_code': return 'That code does not match. Try again or request a new one.'
      case 'locked': return 'Too many wrong attempts. Request a new code.'
      case 'expired': return 'This code expired. Request a fresh one.'
    }
    if (error.status === 401) return 'Please sign in to continue.'
    return error.message || 'Something went wrong. Please try again.'
  }
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.'
}
