import { type Request, type Response } from "express";
import Bid from "../models/Bid.model.js";
import Auction from "../models/Auction.model.js";
import Car from "../models/Car.model.js";
import type { AuthRequest } from "../middleware/auth.middleware.js";
import {
  validateIdParam,
  sendErrorResponse,
  sendSuccessResponse,
  handleControllerError
} from "../utils/validation.utils.js";
import {
  createPaginatedResponse
} from "../utils/query.utils.js";
import type { CreateBidInput, GetBidsQuery } from "../schemas/bid.schema.js";

export const createBid = async (req: AuthRequest, res: Response) => {
  try {
    const { auctionId } = req.params;
    const bidData = req.body as CreateBidInput;

    if (!validateIdParam(auctionId, res, "auction")) return;

    const auction = await Auction.findById(auctionId);
    if (!auction) {
      return sendErrorResponse(res, 404, "Auction not found");
    }

    if (!auction.isCurrentlyActive()) {
      return sendErrorResponse(
        res, 
        400, 
        `Cannot place bid. Auction is ${auction.status}. Bids are only accepted during active auctions.`
      );
    }

    const isCarInAuction = auction.cars.some(
      carId => carId.toString() === bidData.carId
    );

    if (!isCarInAuction) {
      return sendErrorResponse(
        res, 
        400, 
        "This car is not assigned to this auction"
      );
    }

    const car = await Car.findById(bidData.carId);
    if (!car) {
      return sendErrorResponse(res, 404, "Car not found");
    }

    const highestBid = await Bid.findOne({
      auctionId,
      carId: bidData.carId
    }).sort({ amount: -1 });

    if (highestBid && bidData.amount <= highestBid.amount) {
      return sendErrorResponse(
        res,
        400,
        `Bid must be higher than current highest bid of $${highestBid.amount}`
      );
    }

    if (bidData.amount < car.optimizedPrice * 0.5) {
      return sendErrorResponse(
        res,
        400,
        `Bid must be at least $${Math.round(car.optimizedPrice * 0.5)} (50% of estimated price)`
      );
    }

    const existingBid = await Bid.findOne({
      auctionId,
      carId: bidData.carId,
      userId: req.userId
    });

    let bid;
    if (existingBid) {
      existingBid.amount = bidData.amount;
      existingBid.placedAt = new Date();
      bid = await existingBid.save();
    } else {
      bid = await Bid.create({
        auctionId,
        carId: bidData.carId,
        userId: req.userId,
        amount: bidData.amount
      });
    }

    await bid.populate([
      { path: 'userId', select: 'name email' },
      { path: 'carId', select: 'VIN year msrp' }
    ]);

    sendSuccessResponse(
      res, 
      existingBid ? 200 : 201, 
      existingBid ? "Bid updated successfully" : "Bid placed successfully", 
      bid
    );
  } catch (error) {
    handleControllerError(error, res, "bid creation");
  }
};

export const getAuctionWithBids = async (req: Request, res: Response) => {
  try {
    const { auctionId } = req.params;

    if (!validateIdParam(auctionId, res, "auction")) return;

    const auction = await Auction.findById(auctionId)
      .populate('createdBy', 'name email')
      .populate('cars');

    if (!auction) {
      return sendErrorResponse(res, 404, "Auction not found");
    }

    const bids = await Bid.find({ auctionId })
      .populate('userId', 'name email')
      .populate('carId', 'VIN year msrp optimizedPrice')
      .sort({ carId: 1, amount: -1 });

    const carsWithBids = auction.cars.map((car: any) => {
      const carBids = bids.filter(
        bid => bid.carId._id.toString() === car._id.toString()
      );

      const winningBid = carBids.length > 0 ? carBids[0] : null;

      return {
        car: {
          _id: car._id,
          VIN: car.VIN,
          year: car.year,
          msrp: car.msrp,
          grade: car.grade,
          optimizedPrice: car.optimizedPrice
        },
        bids: carBids.map(bid => ({
          _id: bid._id,
          amount: bid.amount,
          user: bid.userId,
          placedAt: bid.placedAt,
          isWinning: winningBid ? (bid._id as any).toString() === (winningBid._id as any).toString() : false
        })),
        highestBid: winningBid ? winningBid.amount : null,
        winner: winningBid ? winningBid.userId : null,
        totalBids: carBids.length
      };
    });

    sendSuccessResponse(res, 200, "Auction with bids retrieved successfully", {
      auction: {
        _id: auction._id,
        name: auction.name,
        startDate: auction.startDate,
        endDate: auction.endDate,
        status: auction.status,
        createdBy: auction.createdBy,
        totalCars: auction.cars.length
      },
      carsWithBids
    });
  } catch (error) {
    handleControllerError(error, res, "auction with bids retrieval");
  }
};

export const getUserBids = async (req: AuthRequest, res: Response) => {
  try {
    const query = req.query as unknown as GetBidsQuery;

    const filters: any = { userId: req.userId };

    if (query.auctionId) filters.auctionId = query.auctionId;
    if (query.carId) filters.carId = query.carId;

    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const sortField = query.sortBy || 'placedAt';
    const sortOrder = query.sortOrder === 'asc' ? 1 : -1;

    const total = await Bid.countDocuments(filters);

    const bids = await Bid.find(filters)
      .sort({ [sortField]: sortOrder })
      .skip(skip)
      .limit(limit)
      .populate('auctionId', 'name startDate endDate status')
      .populate('carId', 'VIN year msrp optimizedPrice');

    const response = createPaginatedResponse(bids, total, { page, limit, skip });

    res.status(200).json({
      success: true,
      message: "User bids retrieved successfully",
      ...response
    });
  } catch (error) {
    handleControllerError(error, res, "user bids retrieval");
  }
};

export const closeAuction = async (req: AuthRequest, res: Response) => {
  try {
    const { auctionId } = req.params;

    if (!validateIdParam(auctionId, res, "auction")) return;

    const auction = await Auction.findById(auctionId);

    if (!auction) {
      return sendErrorResponse(res, 404, "Auction not found");
    }

    if (auction.status !== 'ended') {
      return sendErrorResponse(
        res,
        400,
        "Auction must be ended before closing. Current status: " + auction.status
      );
    }

    if (auction.isClosed) {
      return sendErrorResponse(
        res,
        400,
        "Auction is already closed"
      );
    }

    const allBids = await Bid.find({ auctionId });

    await Bid.updateMany({ auctionId }, { isWinning: false });

    const carIds = [...new Set(allBids.map(bid => bid.carId.toString()))];
    
    const winners = [];
    for (const carId of carIds) {
      const highestBid = await Bid.findOne({
        auctionId,
        carId
      }).sort({ amount: -1 });

      if (highestBid) {
        highestBid.isWinning = true;
        await highestBid.save();
        winners.push({
          carId,
          bidId: highestBid._id,
          userId: highestBid.userId,
          amount: highestBid.amount
        });
      }
    }

    auction.isClosed = true;
    await auction.save();

    sendSuccessResponse(res, 200, "Auction closed and winners determined", {
      auctionId,
      totalCars: carIds.length,
      winners
    });
  } catch (error) {
    handleControllerError(error, res, "auction closing");
  }
};