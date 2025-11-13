import { type Request, type Response } from "express";
import Car from "../models/Car.model.js";

import { 
  validateIdParam, 
  sendErrorResponse, 
  sendSuccessResponse, 
  handleControllerError 
} from "../utils/validation.utils.js";
import {
  buildCarFilters,
  getPaginationParams,
  getSortParams,
  createPaginatedResponse
} from "../utils/query.utils.js";
import type { AuthRequest } from "../middleware/auth.middleware.js";
import { UserRole } from "../models/User.model.js";
import type { CreateCarInput, GetCarsQuery, UpdateCarInput } from "../schemas/car.schema.js";

export const createCar = async (req: AuthRequest, res: Response) => {
  try {
    const carData = req.body as CreateCarInput

    const existingCar = await Car.findOne({ VIN: carData.VIN });
    if (existingCar) {
      return sendErrorResponse(res, 400, "Car with this VIN already exists");
    }

    const car = await Car.create({
      ...carData,
      userId: req.userId,
    });

    sendSuccessResponse(res, 201, "Car created successfully", car);
  } catch (error) {
    handleControllerError(error, res, "car creation");
  }
}

export const getCar = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    if (!validateIdParam(id, res, "car")) return;
    
    const car = await Car.findById(id)
      .populate("userId", "name email");
    if (!car) {
      return sendErrorResponse(res, 404, "Car not found");
    }
    
    sendSuccessResponse(res, 200, "Car found successfully", car);
  } catch (error) {
    handleControllerError(error, res, "car retrieval");
  }
}

export const deleteCar = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    
    if (!validateIdParam(id, res, "car")) return;
    
    const car = await Car.findById(id);
    if (!car) {
      return sendErrorResponse(res, 404, "Car not found");
    }
    
    const isOwner = car.userId.toString() === req.userId;
    const isAdmin = req.userRole === UserRole.ADMIN;
    
    if (!isOwner && !isAdmin) {
      return sendErrorResponse(
        res, 
        403, 
        "You are not authorized to delete this car. Only the owner or admin can delete it."
      );
    }

    await Car.findByIdAndDelete(id);
    
    sendSuccessResponse(res, 200, "Car deleted successfully", car);
  } catch (error) {
    handleControllerError(error, res, "car deletion");
  }
}

export const updateCar = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    if (!validateIdParam(id, res, "car")) return;

    const updatedData = req.body as UpdateCarInput

    const existingCar = await Car.findById(id);

    if (!existingCar) {
      return sendErrorResponse(res, 404, "Car not found");
    }

    if (existingCar.userId.toString() !== req.userId) {
      return sendErrorResponse(res, 403, "You are not authorized to update this car. Only the owner can modify it.");
    }

    if (updatedData.VIN) {
      const existingCar = await Car.findOne({ VIN: updatedData.VIN, _id: { $ne: id } });
      if (existingCar) {
        return sendErrorResponse(res, 400, "Car with this VIN already exists");
      }
    }

    const car = await Car.findByIdAndUpdate(id, updatedData, { 
      new: true,
      runValidators: true
    });

    if (!car) {
      return sendErrorResponse(res, 404, "Car not found");
    }

    sendSuccessResponse(res, 200, "Car updated successfully", car);
  } catch (error) {
    handleControllerError(error, res, "car update");
  }
};

export const getAllCars = async (req: Request, res: Response) => {
  try {
    const query = req.query as unknown as GetCarsQuery;
    
    const filters = buildCarFilters(query);

    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const sortField = query.sortBy || 'createdAt';
    const sortOrder = query.order === 'asc' ? 1 : -1;

    const total = await Car.countDocuments(filters);

    const cars = await Car.find(filters)
      .sort({ [sortField]: sortOrder })
      .skip(skip)
      .limit(limit)
      .populate("userId", "name email");

    const response = createPaginatedResponse(cars, total, { page, limit, skip });

    res.status(200).json({
      success: true,
      message: "Cars retrieved successfully",
      ...response
    });
  } catch (error) {
    handleControllerError(error, res, "cars retrieval");
  }
}

export const calculateCarPrice = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    if (!validateIdParam(id, res, "car")) return;
    
    const car = await Car.findById(id);
    if (!car) {
      return sendErrorResponse(res, 404, "Car not found");
    }
    
    // @ts-expect-error
    const priceWithMarket = await car.calculatePriceWithMarket();
    
    sendSuccessResponse(res, 200, "Price calculated successfully", {
      car: {
        id: car._id,
        VIN: car.VIN,
        year: car.year,
        odometerValue: car.odometerValue,
        msrp: car.msrp,
      },
      grade: car.grade,
      marketAdjustedPrice: priceWithMarket,
    });
  } catch (error) {
    handleControllerError(error, res, "price calculation");
  }
};
