import { Router } from "express";
import { createCar, deleteCar, getCar, getAllCars, updateCar } from "../controllers/car.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";

const router = Router();

router.post("/", authenticate, createCar);
router.get("/", getAllCars);
router.get("/:id", getCar);
router.put("/:id", authenticate, updateCar);
router.delete("/:id", authenticate, deleteCar);

export default router;
