import { Router } from "express";
import { z } from "zod";
import { lineStringSchema, pointSchema } from "../lib/geo";
import { optionalAuth, requireAuth } from "../middleware/auth";
import { asyncHandler } from "../middleware/error";
import { parseId } from "../middleware/ids";
import { bookingService } from "../services/booking.service";
import { chatService } from "../services/chat.service";
import { ridesService } from "../services/rides.service";
import { statsService } from "../services/stats.service";

const router = Router();

const createSchema = z.object({
  origin: pointSchema,
  destination: pointSchema,
  routeGeoJSON: lineStringSchema,
  departTime: z.coerce.date(),
  seats: z.coerce.number().int().min(1).max(6),
  pricePerKm: z.coerce.number().min(0).max(50),
  vehicleType: z.enum(["car", "bike"]).optional(),
});

router.post("/rides", requireAuth, asyncHandler(async (req, res) => {
  const b = createSchema.parse(req.body);
  const ride = await ridesService.create(req.userId!, b);
  res.status(201).json({ ride });
}));

const searchSchema = z.object({
  pickupLat: z.coerce.number().min(-90).max(90),
  pickupLng: z.coerce.number().min(-180).max(180),
  dropLat: z.coerce.number().min(-90).max(90),
  dropLng: z.coerce.number().min(-180).max(180),
  time: z.coerce.date(),
  windowMinutes: z.coerce.number().int().min(5).max(180).default(30),
});

// Public so the SSR page and the AI assistant can call it; auth only hides the user's own rides.
router.get("/rides/search", optionalAuth, asyncHandler(async (req, res) => {
  const q = searchSchema.parse(req.query);
  const results = await ridesService.search({
    userId: req.userId,
    pickup: { lat: q.pickupLat, lng: q.pickupLng },
    drop: { lat: q.dropLat, lng: q.dropLng },
    time: q.time,
    windowMinutes: q.windowMinutes,
  });
  res.json({ results, count: results.length });
}));

// Keep static paths above /rides/:id
router.get("/rides/mine", requireAuth, asyncHandler(async (req, res) => {
  res.json({ rides: await ridesService.mine(req.userId!) });
}));

router.get("/rides/:id", optionalAuth, asyncHandler(async (req, res) => {
  res.json(await ridesService.get(parseId(req.params.id), req.userId));
}));

const bookSchema = z.object({ pickup: pointSchema, drop: pointSchema });

router.post("/rides/:id/book", requireAuth, asyncHandler(async (req, res) => {
  const b = bookSchema.parse(req.body);
  const booking = await bookingService.book(req.userId!, parseId(req.params.id), b.pickup, b.drop);
  res.status(201).json({ booking });
}));

router.post("/rides/:id/complete", requireAuth, asyncHandler(async (req, res) => {
  res.json({ ride: await ridesService.complete(req.userId!, parseId(req.params.id)) });
}));

router.get("/rides/:id/messages", requireAuth, asyncHandler(async (req, res) => {
  res.json({ messages: await chatService.history(parseId(req.params.id), req.userId!) });
}));

router.get("/bookings/mine", requireAuth, asyncHandler(async (req, res) => {
  res.json({ bookings: await statsService.myBookings(req.userId!) });
}));

export default router;
