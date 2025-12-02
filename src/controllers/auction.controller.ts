import { type Request, type Response } from "express";
import type { AuthRequest } from "../middleware/auth.middleware.js";
import {
  validateIdParam,
  sendErrorResponse,
  sendSuccessResponse,
  handleControllerError
} from "../utils/validation.utils.js";
import {
  getPaginationParams,
  getSortParams,
} from "../utils/query.utils.js";
import type { CreateAuctionInput, UpdateAuctionInput } from "../schemas/auction.schema.js";
import type { AssignCarsInput } from "../schemas/bid.schema.js";
import { getRepo } from "../db/index.js";
import type { AuctionFilters } from "../db/interfaces/IAuctionRepository.js";

export const createAuction = async (req: AuthRequest, res: Response) => {
  try {
    const { auction: auctionRepo } = getRepo();
    const auctionData = req.body as CreateAuctionInput;

    const overlappingAuction = await auctionRepo.findOverlapping(
      auctionData.startDate,
      auctionData.endDate
    );

    if (overlappingAuction) {
      return sendErrorResponse(
        res,
        400,
        `Auction time overlaps with existing auction: "${overlappingAuction.name}"`
      );
    }

    const auction = await auctionRepo.create({
      ...auctionData,
      createdBy: req.userId!,
      cars: []
    });

    sendSuccessResponse(res, 201, "Auction created successfully", auction);
  } catch (error) {
    handleControllerError(error, res, "auction creation");
  }
};

export const getAuction = async (req: Request, res: Response) => {
  try {
    const { auction: auctionRepo } = getRepo();
    const { id } = req.params;

    if (!validateIdParam(id, res, "auction")) return;

    const auction = await auctionRepo.findByIdWithDetails(id);

    if (!auction) {
      return sendErrorResponse(res, 404, "Auction not found");
    }

    sendSuccessResponse(res, 200, "Auction retrieved successfully", auction);
  } catch (error) {
    handleControllerError(error, res, "auction retrieval");
  }
};

export const getAllAuctions = async (req: Request, res: Response) => {
  try {
    const { auction: auctionRepo } = getRepo();
    
    const filters: AuctionFilters = {};

    const status = req.query.status as string;
    if (status && ['upcoming', 'active', 'ended', 'closed'].includes(status)) {
      filters.status = status as AuctionFilters['status'];
    }

    if (req.query.createdBy) {
      filters.createdBy = req.query.createdBy as string;
    }

    if (req.query.search) {
      filters.name = req.query.search as string;
    }

    const pagination = getPaginationParams(req.query, 10, 100);

    const allowedSortFields = ['name', 'startDate', 'endDate', 'createdAt'];
    const { sortField, sortOrder } = getSortParams(req.query, allowedSortFields);

    const result = await auctionRepo.findAll(
      filters,
      pagination,
      { sortField, sortOrder }
    );

    res.status(200).json({
      success: true,
      message: "Auctions retrieved successfully",
      data: result.data,
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      }
    });
  } catch (error) {
    handleControllerError(error, res, "auctions retrieval");
  }
};

export const updateAuction = async (req: AuthRequest, res: Response) => {
  try {
    const { auction: auctionRepo } = getRepo();
    const { id } = req.params;

    if (!validateIdParam(id, res, "auction")) return;

    const updateData = req.body as UpdateAuctionInput;

    const auction = await auctionRepo.findById(id);

    if (!auction) {
      return sendErrorResponse(res, 404, "Auction not found");
    }

    if (new Date() >= auction.startDate) {
      return sendErrorResponse(
        res,
        400,
        "Cannot edit auction that has already started or ended"
      );
    }

    if (updateData.startDate || updateData.endDate) {
      const newStartDate = updateData.startDate || auction.startDate;
      const newEndDate = updateData.endDate || auction.endDate;

      const overlappingAuction = await auctionRepo.findOverlapping(
        newStartDate,
        newEndDate,
        id
      );

      if (overlappingAuction) {
        return sendErrorResponse(
          res,
          400,
          `Updated time overlaps with auction: "${overlappingAuction.name}"`
        );
      }
    }

    const updatedAuction = await auctionRepo.update(id, updateData);

    sendSuccessResponse(res, 200, "Auction updated successfully", updatedAuction);
  } catch (error) {
    handleControllerError(error, res, "auction update");
  }
};

export const deleteAuction = async (req: AuthRequest, res: Response) => {
  try {
    const { auction: auctionRepo, bid: bidRepo } = getRepo();
    const { id } = req.params;

    if (!validateIdParam(id, res, "auction")) return;

    const auction = await auctionRepo.findById(id);

    if (!auction) {
      return sendErrorResponse(res, 404, "Auction not found");
    }

    const now = new Date();
    if (now >= auction.startDate && now <= auction.endDate) {
      return sendErrorResponse(
        res,
        400,
        "Cannot delete an active auction. Please wait until it ends."
      );
    }

    await bidRepo.deleteByAuction(id);
    await auctionRepo.delete(id);

    sendSuccessResponse(res, 200, "Auction deleted successfully", auction);
  } catch (error) {
    handleControllerError(error, res, "auction deletion");
  }
};

export const getCurrentAuction = async (req: Request, res: Response) => {
  try {
    const { auction: auctionRepo } = getRepo();

    const result = await auctionRepo.findAll(
      { status: 'active' },
      { page: 1, limit: 1, skip: 0 },
      { sortField: 'startDate', sortOrder: 1 }
    );

    if (result.data.length === 0) {
      return sendErrorResponse(res, 404, "No active auction at the moment");
    }

    sendSuccessResponse(res, 200, "Current auction retrieved successfully", result.data[0]);
  } catch (error) {
    handleControllerError(error, res, "current auction retrieval");
  }
};

export const assignCarsToAuction = async (req: AuthRequest, res: Response) => {
  try {
    const { auction: auctionRepo, car: carRepo } = getRepo();
    const { auctionId } = req.params;
    const { carIds } = req.body as AssignCarsInput;

    if (!validateIdParam(auctionId, res, "auction")) return;

    const auction = await auctionRepo.findById(auctionId);

    if (!auction) {
      return sendErrorResponse(res, 404, "Auction not found");
    }

    if (auction.status !== 'upcoming') {
      return sendErrorResponse(
        res,
        400,
        `Cannot assign cars to ${auction.status} auction. Only upcoming auctions can be modified.`
      );
    }

    for (const carId of carIds) {
      const car = await carRepo.findById(carId);
      if (!car) {
        return sendErrorResponse(res, 400, `Car with id ${carId} not found`);
      }
    }

    const existingCarIds = auction.cars;
    const newCarIds = carIds.filter(id => !existingCarIds.includes(id));

    let updatedAuction = auction;
    for (const carId of newCarIds) {
      const result = await auctionRepo.addCar(auctionId, carId);
      if (result) updatedAuction = result;
    }

    const auctionWithDetails = await auctionRepo.findByIdWithDetails(auctionId);

    sendSuccessResponse(res, 200, "Cars assigned to auction successfully", {
      auction: {
        id: updatedAuction.id,
        name: updatedAuction.name,
        totalCars: updatedAuction.cars.length
      },
      newlyAssigned: newCarIds.length,
      cars: auctionWithDetails?.carsData || []
    });
  } catch (error) {
    handleControllerError(error, res, "cars assignment");
  }
};

export const removeCarFromAuction = async (req: AuthRequest, res: Response) => {
  try {
    const { auction: auctionRepo, bid: bidRepo } = getRepo();
    const { auctionId, carId } = req.params;

    if (!validateIdParam(auctionId, res, "auction")) return;
    if (!validateIdParam(carId, res, "car")) return;

    const auction = await auctionRepo.findById(auctionId);

    if (!auction) {
      return sendErrorResponse(res, 404, "Auction not found");
    }

    if (auction.status !== 'upcoming') {
      return sendErrorResponse(
        res,
        400,
        `Cannot remove cars from ${auction.status} auction`
      );
    }

    await auctionRepo.removeCar(auctionId, carId);

    const bids = await bidRepo.findByAuctionAndCar(auctionId, carId);
    for (const bid of bids) {
      await bidRepo.delete(bid.id);
    }

    const updatedAuction = await auctionRepo.findById(auctionId);

    sendSuccessResponse(res, 200, "Car removed from auction successfully", {
      auctionId,
      carId,
      remainingCars: updatedAuction?.cars.length || 0
    });
  } catch (error) {
    handleControllerError(error, res, "car removal");
  }
};
