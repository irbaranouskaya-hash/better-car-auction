import { Router } from "express";
import { createCar, deleteCar, getCar, getAllCars, updateCar, calculateCarPrice } from "../controllers/car.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import { createCarSchema, updateCarSchema } from "../schemas/car.schema.js";


const router = Router();

router.post("/", authenticate, validate(createCarSchema), createCar);
router.get("/", getAllCars);
router.get("/:id", getCar);
router.get("/:id/price", calculateCarPrice);
router.put("/:id", authenticate, validate(updateCarSchema), updateCar);
router.delete("/:id", authenticate, deleteCar);

export default router;
