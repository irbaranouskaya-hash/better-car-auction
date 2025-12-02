import { type Request, type Response } from "express";
import type { AuthRequest } from "../middleware/auth.middleware.js";
import {
  validateIdParam,
  sendErrorResponse,
  sendSuccessResponse,
  handleControllerError
} from "../utils/validation.utils.js";
import type { CreateBidInput, GetBidsQuery } from "../schemas/bid.schema.js";
import { getRepo } from "../db/index.js";
import type { BidFilters } from "../db/interfaces/IBidRepository.js";

export const createBid = async (req: AuthRequest, res: Response) => {
  try {
    const { auction: auctionRepo, car: carRepo, bid: bidRepo } = getRepo();
    const auctionId = req.params.auctionId as string;
    const bidData = req.body as CreateBidInput;

    if (!validateIdParam(auctionId, res, "auction")) return;

    const auction = await auctionRepo.findById(auctionId);
    if (!auction) {
      return sendErrorResponse(res, 404, "Auction not found");
    }

    if (auction.status !== 'active') {
      return sendErrorResponse(
        res, 
        400, 
        `Cannot place bid. Auction is ${auction.status}. Bids are only accepted during active auctions.`
      );
    }

    const isCarInAuction = auction.cars.includes(bidData.carId);

    if (!isCarInAuction) {
      return sendErrorResponse(
        res, 
        400, 
        "This car is not assigned to this auction"
      );
    }

    const car = await carRepo.findById(bidData.carId);
    if (!car) {
      return sendErrorResponse(res, 404, "Car not found");
    }

    const highestBid = await bidRepo.findHighestForCar(auctionId, bidData.carId);

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

    const existingBid = await bidRepo.findExisting(auctionId, bidData.carId, req.userId!);

    let bid;
    let isUpdate = false;
    if (existingBid) {
      bid = await bidRepo.update(existingBid.id, { 
        amount: bidData.amount, 
        placedAt: new Date() 
      });
      isUpdate = true;
    } else {
      bid = await bidRepo.create({
        auctionId,
        carId: bidData.carId,
        userId: req.userId!,
        amount: bidData.amount
      });
    }

    const bidWithDetails = await bidRepo.findByIdWithDetails(bid!.id);

    sendSuccessResponse(
      res, 
      isUpdate ? 200 : 201, 
      isUpdate ? "Bid updated successfully" : "Bid placed successfully", 
      bidWithDetails
    );
  } catch (error) {
    handleControllerError(error, res, "bid creation");
  }
};

export const getAuctionWithBids = async (req: Request, res: Response) => {
  try {
    const { auction: auctionRepo, bid: bidRepo } = getRepo();
    const auctionId = req.params.auctionId as string;

    if (!validateIdParam(auctionId, res, "auction")) return;

    const auction = await auctionRepo.findByIdWithDetails(auctionId);

    if (!auction) {
      return sendErrorResponse(res, 404, "Auction not found");
    }

    const bids = await bidRepo.findAll(
      { auctionId: auctionId },
      { page: 1, limit: 1000, skip: 0 },
      { sortField: 'amount', sortOrder: -1 }
    );

    const carsWithBids = (auction.carsData || []).map((car) => {
      const carBids = bids.data.filter(bid => bid.carId === car.id);
      const winningBid = carBids.length > 0 ? carBids[0] : null;

      return {
        car: {
          id: car.id,
          VIN: car.VIN,
          brand: car.brand,
          model: car.model,
          year: car.year,
          msrp: car.msrp,
          grade: car.grade,
          optimizedPrice: car.optimizedPrice
        },
        bids: carBids.map(bid => ({
          id: bid.id,
          amount: bid.amount,
          user: bid.user,
          placedAt: bid.placedAt,
          isWinning: winningBid ? bid.id === winningBid.id : false
        })),
        highestBid: winningBid ? winningBid.amount : null,
        winner: winningBid ? winningBid.user : null,
        totalBids: carBids.length
      };
    });

    sendSuccessResponse(res, 200, "Auction with bids retrieved successfully", {
      auction: {
        id: auction.id,
        name: auction.name,
        startDate: auction.startDate,
        endDate: auction.endDate,
        status: auction.status,
        creator: auction.creator,
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
    const { bid: bidRepo } = getRepo();
    const query = req.query as unknown as GetBidsQuery;

    const filters: BidFilters = { userId: req.userId! };

    if (query.auctionId) filters.auctionId = query.auctionId;
    if (query.carId) filters.carId = query.carId;

    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const sortField = query.sortBy || 'placedAt';
    const sortOrder = query.sortOrder === 'asc' ? 1 : -1;

    const result = await bidRepo.findAll(
      filters,
      { page, limit, skip },
      { sortField, sortOrder }
    );

    res.status(200).json({
      success: true,
      message: "User bids retrieved successfully",
      data: result.data,
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      }
    });
  } catch (error) {
    handleControllerError(error, res, "user bids retrieval");
  }
};

export const closeAuction = async (req: AuthRequest, res: Response) => {
  try {
    const { auction: auctionRepo, bid: bidRepo } = getRepo();
    const auctionId = req.params.auctionId as string;

    if (!validateIdParam(auctionId, res, "auction")) return;

    const auction = await auctionRepo.findById(auctionId);

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

    const allBids = await bidRepo.findByAuction(auctionId);

    await bidRepo.resetWinningForAuction(auctionId);

    const carIds = [...new Set(allBids.map(bid => bid.carId))];
    
    const winners = [];
    for (const carId of carIds) {
      const highestBid = await bidRepo.findHighestForCar(auctionId, carId);

      if (highestBid) {
        await bidRepo.setWinning(highestBid.id, true);
        winners.push({
          carId,
          bidId: highestBid.id,
          userId: highestBid.userId,
          amount: highestBid.amount
        });
      }
    }

    await auctionRepo.close(auctionId);

    sendSuccessResponse(res, 200, "Auction closed and winners determined", {
      auctionId,
      totalCars: carIds.length,
      winners
    });
  } catch (error) {
    handleControllerError(error, res, "auction closing");
  }
};
