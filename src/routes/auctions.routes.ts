import { Router } from "express";
import {
  createAuction,
  getAuction,
  getAllAuctions,
  updateAuction,
  deleteAuction,
  getCurrentAuction,
  removeCarFromAuction,
  assignCarsToAuction
} from "../controllers/auction.controller.js";
import { authenticate, requireAdmin } from "../middleware/auth.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import { createAuctionSchema, updateAuctionSchema } from "../schemas/auction.schema.js";
import { assignCarsSchema } from "../schemas/bid.schema.js";

const router = Router();

router.get("/", getAllAuctions);
router.get("/current", getCurrentAuction);
router.get("/:id", getAuction);

router.post(
  "/",
  authenticate,
  requireAdmin,
  validate(createAuctionSchema),
  createAuction
);

router.patch(
  "/:id",
  authenticate,
  requireAdmin,
  validate(updateAuctionSchema),
  updateAuction
);

router.delete(
  "/:id",
  authenticate,
  requireAdmin,
  deleteAuction
);

router.post(
  "/:auctionId/cars",
  authenticate,
  requireAdmin,
  validate(assignCarsSchema),
  assignCarsToAuction
);

router.delete(
  "/:auctionId/cars/:carId",
  authenticate,
  requireAdmin,
  removeCarFromAuction
);

export default router;