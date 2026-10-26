import { z } from "zod";

export const pointSchema = z.object({
  label: z.string().trim().min(1).max(200),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});
export type PointInput = z.infer<typeof pointSchema>;

/** GeoJSON LineString, [lng, lat] order. Cap vertex count to keep payloads sane. */
export const lineStringSchema = z.object({
  type: z.literal("LineString"),
  coordinates: z
    .array(z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]))
    .min(2)
    .max(6000),
});

export const MIN_FARE = 10;

/** Fare for a travelled segment. Guests pay only for the part of the route they ride. */
export function fareFor(segmentMeters: number, pricePerKm: number): number {
  const km = segmentMeters / 1000;
  return Math.max(MIN_FARE, Math.round(km * pricePerKm));
}

export interface ScoreInput {
  pickupOffRouteM: number;
  dropOffRouteM: number;
  minutesApart: number;
  windowMinutes: number;
  hostAvgRating: number | null;
  maxOffRouteM: number;
}

/**
 * Match percentage (0-100).
 *  45% proximity (how close pickup/drop are to the host route)
 *  35% time fit  (how close departure is to the requested time)
 *  20% host rating (neutral 4.0 when unrated)
 */
export function scoreMatch(i: ScoreInput): number {
  const clamp = (n: number) => Math.min(1, Math.max(0, n));
  const proximity = 1 - clamp((i.pickupOffRouteM + i.dropOffRouteM) / (2 * i.maxOffRouteM));
  const time = 1 - clamp(i.minutesApart / Math.max(1, i.windowMinutes));
  const rating = clamp((i.hostAvgRating ?? 4) / 5);
  return Math.round(100 * (0.45 * proximity + 0.35 * time + 0.2 * rating));
}

/** 0-100 trust score shown on host badges. */
export function trustScore(completedRides: number, avgRating: number | null, emailVerified: boolean): number {
  const base = emailVerified ? 40 : 10;
  const experience = Math.min(30, completedRides * 3);
  const reputation = avgRating == null ? 15 : (avgRating / 5) * 30;
  return Math.round(base + experience + reputation);
}

export const CO2_KG_PER_KM = 0.12;
