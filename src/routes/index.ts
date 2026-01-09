import { Router } from "express";
import carsRouter from "./cars.routes.js";
import auctionsRouter from "./auctions.routes.js";
import usersRouter from "./users.routes.js";
import bidsRoutes from "./bids.routes.js";

const router = Router();

router.use("/cars", carsRouter);
router.use("/auctions", auctionsRouter);
router.use("/users", usersRouter);
router.use("/bids", bidsRoutes);


router.get("/", (req, res) => {
  res.json({
    message: "Better Car Auction API",
    version: "1.0.0",
    endpoints: {
      cars: "/api/cars",
      auctions: "/api/auctions",
    },
  });
});

export default router;
