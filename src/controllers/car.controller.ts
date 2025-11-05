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

export const createCar = async (req: AuthRequest, res: Response) => {
  try {
    const {VIN, odometerValue, year, exteriorColor, interiorColor, haveStrongScratches, haveSmallScratches, haveMalfunctions, haveElectricFailures} = req.body;

    if(!VIN || !odometerValue || !year || !exteriorColor || !interiorColor || 
       haveStrongScratches === undefined || haveSmallScratches === undefined || haveMalfunctions === undefined || haveElectricFailures === undefined) {
      return sendErrorResponse(res, 400, "All fields are required");
    }

    const existingCar = await Car.findOne({ VIN });
    if (existingCar) {
      return sendErrorResponse(res, 400, "Car with this VIN already exists");
    }

    const car = await Car.create({
      VIN,
      odometerValue,
      year,
      exteriorColor,
      interiorColor,
      haveStrongScratches,
      haveSmallScratches,
      haveMalfunctions,
      haveElectricFailures,
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

    if (car.userId.toString() !== req.userId) {
      return sendErrorResponse(res, 403, "You are not authorized to delete this car...");
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

    const { VIN, odometerValue, year, exteriorColor, interiorColor, haveStrongScratches, haveSmallScratches, haveMalfunctions, haveElectricFailures } = req.body;

    const existingCar = await Car.findById(id);

    if (!existingCar) {
      return sendErrorResponse(res, 404, "Car not found");
    }

    if (existingCar.userId.toString() !== req.userId) {
      
      return sendErrorResponse(res, 403, "You are not authorized to update this car. Only the owner can modify it.");
    }

    if (!VIN && !odometerValue && !year && !exteriorColor && !interiorColor && 
        haveStrongScratches === undefined && haveSmallScratches === undefined && haveMalfunctions === undefined && haveElectricFailures === undefined) {
      return sendErrorResponse(res, 400, "At least one field is required for update");
    }

    if (VIN) {
      const existingCar = await Car.findOne({ VIN, _id: { $ne: id } });
      if (existingCar) {
        return sendErrorResponse(res, 400, "Car with this VIN already exists");
      }
    }

    const updateData: any = {};
    if (VIN) updateData.VIN = VIN;
    if (odometerValue) updateData.odometerValue = odometerValue;
    if (year) updateData.year = year;
    if (exteriorColor) updateData.exteriorColor = exteriorColor;
    if (interiorColor) updateData.interiorColor = interiorColor;
    if (haveStrongScratches !== undefined) updateData.haveStrongScratches = haveStrongScratches;
    if (haveSmallScratches !== undefined) updateData.haveSmallScratches = haveSmallScratches;
    if (haveMalfunctions !== undefined) updateData.haveMalfunctions = haveMalfunctions;
    if (haveElectricFailures !== undefined) updateData.haveElectricFailures = haveElectricFailures;

    const car = await Car.findByIdAndUpdate(id, updateData, { 
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
    const filters = buildCarFilters(req.query);

    const pagination = getPaginationParams(req.query, 10, 100);

    const allowedSortFields = [
      "VIN",
      "odometerValue",
      "year",
      "exteriorColor",
      "interiorColor",
      "createdAt",
      "updatedAt"
    ];
    const { sortField, sortOrder } = getSortParams(req.query, allowedSortFields);

    const total = await Car.countDocuments(filters);

    const cars = await Car.find(filters)
      .sort({ [sortField]: sortOrder })
      .skip(pagination.skip)
      .limit(pagination.limit)
      .populate("userId", "name email");

    const response = createPaginatedResponse(cars, total, pagination);

    res.status(200).json({
      success: true,
      message: "Cars retrieved successfully",
      ...response
    });
  } catch (error) {
    handleControllerError(error, res, "cars retrieval");
  }
}
