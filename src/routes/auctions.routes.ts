import { Router } from "express";
import {
  createAuction,
  getAuction,
  getAllAuctions,
  updateAuction,
  deleteAuction,
  getCurrentAuction
} from "../controllers/auction.controller.js";
import { authenticate, requireAdmin } from "../middleware/auth.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import { createAuctionSchema, updateAuctionSchema } from "../schemas/auction.schema.js";

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

export default router;