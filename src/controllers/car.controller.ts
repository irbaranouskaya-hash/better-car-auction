import { type Request, type Response } from "express";
import { 
  validateIdParam, 
  sendErrorResponse, 
  sendSuccessResponse, 
  handleControllerError 
} from "../utils/validation.utils.js";
import type { AuthRequest } from "../middleware/auth.middleware.js";
import type { CreateCarInput, GetCarsQuery, UpdateCarInput } from "../schemas/car.schema.js";
import { getRepo } from "../db/index.js";
import type { CarFilters } from "../db/interfaces/ICarRepository.js";

export const createCar = async (req: AuthRequest, res: Response) => {
  try {
    const { car: carRepo } = getRepo();
    const carData = req.body as CreateCarInput;

    const existingCar = await carRepo.findByVIN(carData.VIN);
    if (existingCar) {
      return sendErrorResponse(res, 400, "Car with this VIN already exists");
    }

    const car = await carRepo.create({
      ...carData,
      userId: req.userId!,
    });

    sendSuccessResponse(res, 201, "Car created successfully", car);
  } catch (error) {
    handleControllerError(error, res, "car creation");
  }
};

export const getCar = async (req: Request, res: Response) => {
  try {
    const { car: carRepo } = getRepo();
    const { id } = req.params;
    
    if (!validateIdParam(id, res, "car")) return;
    
    const car = await carRepo.findByIdWithOwner(id);
    if (!car) {
      return sendErrorResponse(res, 404, "Car not found");
    }
    
    sendSuccessResponse(res, 200, "Car found successfully", car);
  } catch (error) {
    handleControllerError(error, res, "car retrieval");
  }
};

export const deleteCar = async (req: AuthRequest, res: Response) => {
  try {
    const { car: carRepo } = getRepo();
    const { id } = req.params;
    
    if (!validateIdParam(id, res, "car")) return;
    
    const car = await carRepo.findById(id);
    if (!car) {
      return sendErrorResponse(res, 404, "Car not found");
    }
    
    const isOwner = car.userId === req.userId;
    const isAdmin = req.userRole === 'admin';
    
    if (!isOwner && !isAdmin) {
      return sendErrorResponse(
        res, 
        403, 
        "You are not authorized to delete this car. Only the owner or admin can delete it."
      );
    }

    await carRepo.delete(id);
    
    sendSuccessResponse(res, 200, "Car deleted successfully", car);
  } catch (error) {
    handleControllerError(error, res, "car deletion");
  }
};

export const updateCar = async (req: AuthRequest, res: Response) => {
  try {
    const { car: carRepo } = getRepo();
    const { id } = req.params;

    if (!validateIdParam(id, res, "car")) return;

    const updatedData = req.body as UpdateCarInput;

    const existingCar = await carRepo.findById(id);

    if (!existingCar) {
      return sendErrorResponse(res, 404, "Car not found");
    }

    if (existingCar.userId !== req.userId) {
      return sendErrorResponse(res, 403, "You are not authorized to update this car. Only the owner can modify it.");
    }

    if (updatedData.VIN) {
      const carWithVIN = await carRepo.findByVINExcluding(updatedData.VIN, id);
      if (carWithVIN) {
        return sendErrorResponse(res, 400, "Car with this VIN already exists");
      }
    }

    const car = await carRepo.update(id, updatedData);

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
    const { car: carRepo } = getRepo();
    const query = req.query as unknown as GetCarsQuery;
    
    const filters: CarFilters = {
      userId: query.userId,
      VIN: query.VIN,
      brand: query.brand,
      model: query.model,
      exteriorColor: query.exteriorColor,
      interiorColor: query.interiorColor,
      odometerValue: query.odometerValue,
      year: query.year,
      minOdometer: query.minOdometer,
      maxOdometer: query.maxOdometer,
      minYear: query.minYear,
      maxYear: query.maxYear,
      haveStrongScratches: query.haveStrongScratches,
      haveSmallScratches: query.haveSmallScratches,
      haveMalfunctions: query.haveMalfunctions,
      haveElectricFailures: query.haveElectricFailures,
    };

    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const sortField = query.sortBy || 'createdAt';
    const sortOrder = query.order === 'asc' ? 1 : -1;

    const result = await carRepo.findAll(
      filters,
      { page, limit, skip },
      { sortField, sortOrder }
    );

    res.status(200).json({
      success: true,
      message: "Cars retrieved successfully",
      data: result.data,
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      }
    });
  } catch (error) {
    handleControllerError(error, res, "cars retrieval");
  }
};

export const calculateCarPrice = async (req: Request, res: Response) => {
  try {
    const { car: carRepo } = getRepo();
    const { id } = req.params;
    
    if (!validateIdParam(id, res, "car")) return;
    
    const car = await carRepo.findById(id);
    if (!car) {
      return sendErrorResponse(res, 404, "Car not found");
    }
    
    const similarCars = await carRepo.findSimilar(car.year, car.odometerValue, id, 10);
    
    let priceWithMarket = car.optimizedPrice;
    if (similarCars.length > 0) {
      const avgMarketPrice = similarCars.reduce((sum, c) => sum + c.optimizedPrice, 0) / similarCars.length;
      priceWithMarket = Math.round((car.optimizedPrice + avgMarketPrice) / 2);
    }
    
    sendSuccessResponse(res, 200, "Price calculated successfully", {
      car: {
        id: car.id,
        VIN: car.VIN,
        brand: car.brand,
        model: car.model,
        year: car.year,
        odometerValue: car.odometerValue,
        msrp: car.msrp,
      },
      grade: car.grade,
      optimizedPrice: car.optimizedPrice,
      marketAdjustedPrice: priceWithMarket,
      similarCarsCount: similarCars.length,
    });
  } catch (error) {
    handleControllerError(error, res, "price calculation");
  }
};
