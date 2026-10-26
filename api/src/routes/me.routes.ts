import { Router } from "express";
import { z } from "zod";
import { notFound } from "../lib/errors";
import { requireAuth } from "../middleware/auth";
import { asyncHandler } from "../middleware/error";
import { usersRepo } from "../repositories/users.repo";

const router = Router();

router.get("/me", requireAuth, asyncHandler(async (req, res) => {
  const user = await usersRepo.findById(req.userId!);
  if (!user) throw notFound("User not found");
  res.json({ user });
}));

const profileSchema = z.object({
  name: z.string().trim().min(2).max(80),
  role: z.enum(["host", "guest"]),
  vehicleType: z.enum(["car", "bike"]).nullish(),
  officeLocation: z.string().trim().max(200).nullish(),
});

router.put("/me", requireAuth, asyncHandler(async (req, res) => {
  const b = profileSchema.parse(req.body);
  const user = await usersRepo.updateProfile(req.userId!, {
    name: b.name,
    role: b.role,
    // only hosts need a vehicle
    vehicleType: b.role === "host" ? (b.vehicleType ?? "car") : null,
    officeLocation: b.officeLocation ?? null,
  });
  res.json({ user });
}));

export default router;
