import { type Request, type Response } from "express";
import Auction from "../models/Auction.model.js";
import Car from "../models/Car.model.js";
import Bid from "../models/Bid.model.js";
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
  createPaginatedResponse
} from "../utils/query.utils.js";
import type { CreateAuctionInput, UpdateAuctionInput } from "../schemas/auction.schema.js";
import mongoose, { Types } from "mongoose";
import type { AssignCarsInput } from "../schemas/bid.schema.js";

export const createAuction = async (req: AuthRequest, res: Response) => {
  try {
    const auctionData = req.body as CreateAuctionInput;

    const overlappingAuction = await Auction.findOverlapping(
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

    const auction = await Auction.create({
      ...auctionData,
      createdBy: req.userId
    });

    sendSuccessResponse(res, 201, "Auction created successfully", auction);
  } catch (error) {
    handleControllerError(error, res, "auction creation");
  }
};

export const getAuction = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!validateIdParam(id, res, "auction")) return;

    const auction = await Auction.findById(id)
      .populate("createdBy", "name email");

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
    const filters: any = {};

    const status = req.query.status as string;
    const now = new Date();

    if (status === 'upcoming') {
      filters.startDate = { $gt: now };
    } else if (status === 'active') {
      filters.startDate = { $lte: now };
      filters.endDate = { $gte: now };
    } else if (status === 'ended') {
      filters.endDate = { $lt: now };
    }

    if (req.query.createdBy) {
      filters.createdBy = req.query.createdBy;
    }

    if (req.query.search) {
      filters.name = { $regex: req.query.search, $options: 'i' };
    }

    const pagination = getPaginationParams(req.query, 10, 100);

    const allowedSortFields = ['name', 'startDate', 'endDate', 'createdAt'];
    const { sortField, sortOrder } = getSortParams(req.query, allowedSortFields);

    const total = await Auction.countDocuments(filters);

    const auctions = await Auction.find(filters)
      .sort({ [sortField]: sortOrder })
      .skip(pagination.skip)
      .limit(pagination.limit)
      .populate("createdBy", "name email");

    const response = createPaginatedResponse(auctions, total, pagination);

    res.status(200).json({
      success: true,
      message: "Auctions retrieved successfully",
      ...response
    });
  } catch (error) {
    handleControllerError(error, res, "auctions retrieval");
  }
};

export const updateAuction = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    if (!validateIdParam(id, res, "auction")) return;

    const updateData = req.body as UpdateAuctionInput;

    const auction = await Auction.findById(id);

    if (!auction) {
      return sendErrorResponse(res, 404, "Auction not found");
    }

    if (!auction.canBeEdited()) {
      return sendErrorResponse(
        res,
        400,
        "Cannot edit auction that has already started or ended"
      );
    }

    if (updateData.startDate || updateData.endDate) {
      const newStartDate = updateData.startDate || auction.startDate;
      const newEndDate = updateData.endDate || auction.endDate;

      const overlappingAuction = await Auction.findOverlapping(
        newStartDate,
        newEndDate,
        typeof id === 'string' ? new Types.ObjectId(id) : id
      );

      if (overlappingAuction) {
        return sendErrorResponse(
          res,
          400,
          `Updated time overlaps with auction: "${overlappingAuction.name}"`
        );
      }
    }

    Object.assign(auction, updateData);
    await auction.save();

    sendSuccessResponse(res, 200, "Auction updated successfully", auction);
  } catch (error) {
    handleControllerError(error, res, "auction update");
  }
};

export const deleteAuction = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    if (!validateIdParam(id, res, "auction")) return;

    const auction = await Auction.findById(id);

    if (!auction) {
      return sendErrorResponse(res, 404, "Auction not found");
    }

    if (auction.isCurrentlyActive()) {
      return sendErrorResponse(
        res,
        400,
        "Cannot delete an active auction. Please wait until it ends."
      );
    }

    await Auction.findByIdAndDelete(id);

    sendSuccessResponse(res, 200, "Auction deleted successfully", auction);
  } catch (error) {
    handleControllerError(error, res, "auction deletion");
  }
};

export const getCurrentAuction = async (req: Request, res: Response) => {
  try {
    const now = new Date();

    const auction = await Auction.findOne({
      startDate: { $lte: now },
      endDate: { $gte: now }
    }).populate("createdBy", "name email");

    if (!auction) {
      return sendErrorResponse(res, 404, "No active auction at the moment");
    }

    sendSuccessResponse(res, 200, "Current auction retrieved successfully", auction);
  } catch (error) {
    handleControllerError(error, res, "current auction retrieval");
  }
};

export const assignCarsToAuction = async (req: AuthRequest, res: Response) => {
  try {
    const { auctionId } = req.params;
    const { carIds } = req.body as AssignCarsInput;

    if (!validateIdParam(auctionId, res, "auction")) return;

    const auction = await Auction.findById(auctionId);

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

    const cars = await Car.find({ _id: { $in: carIds } });

    if (cars.length !== carIds.length) {
      return sendErrorResponse(
        res,
        400,
        "Some cars were not found"
      );
    }

    const now = new Date();
    const conflictingAuctions = await Auction.find({
      _id: { $ne: auctionId },
      cars: { $in: carIds },
      endDate: { $gte: now }
    });

    if (conflictingAuctions.length > 0) {
      return sendErrorResponse(
        res,
        400,
        `Some cars are already assigned to other active auctions: ${conflictingAuctions.map(a => a.name).join(', ')}`
      );
    }

    const existingCarIds = auction.cars.map(id => id.toString());
    const newCarIds = carIds.filter(id => !existingCarIds.includes(id));

    auction.cars.push(...newCarIds.map(id => new mongoose.Types.ObjectId(id)));
    await auction.save();

    await auction.populate('cars');

    sendSuccessResponse(res, 200, "Cars assigned to auction successfully", {
      auction: {
        _id: auction._id,
        name: auction.name,
        totalCars: auction.cars.length
      },
      newlyAssigned: newCarIds.length,
      cars: auction.cars
    });
  } catch (error) {
    handleControllerError(error, res, "cars assignment");
  }
};

export const removeCarFromAuction = async (req: AuthRequest, res: Response) => {
  try {
    const { auctionId, carId } = req.params;

    if (!validateIdParam(auctionId, res, "auction")) return;
    if (!validateIdParam(carId, res, "car")) return;

    const auction = await Auction.findById(auctionId);

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

    auction.cars = auction.cars.filter(id => id.toString() !== carId);
    await auction.save();

    await Bid.deleteMany({ auctionId, carId });

    sendSuccessResponse(res, 200, "Car removed from auction successfully", {
      auctionId,
      carId,
      remainingCars: auction.cars.length
    });
  } catch (error) {
    handleControllerError(error, res, "car removal");
  }
};