import { Router } from "express";
import {
  createBid,
  getAuctionWithBids,
  getUserBids,
  closeAuction
} from "../controllers/bid.controller.js";
import { authenticate, requireAdmin } from "../middleware/auth.middleware.js";
import { validate, validateQuery } from "../middleware/validate.middleware.js";
import { 
  createBidSchema,
  getBidsQuerySchema
} from "../schemas/bid.schema.js";

const router = Router();

router.get(
  "/auctions/:auctionId/details",
  getAuctionWithBids
);

router.post(
  "/auctions/:auctionId/bids",
  authenticate,
  validate(createBidSchema),
  createBid
);

router.get(
  "/my-bids",
  authenticate,
  validateQuery(getBidsQuerySchema),
  getUserBids
);

router.post(
  "/auctions/:auctionId/close",
  authenticate,
  requireAdmin,
  closeAuction
);

export default router;