import Bid from '../../../models/Bid.model.js';
import type { IBidRepository, BidFilters, IBidWithDetails } from '../../interfaces/IBidRepository.js';
import type { IBid, CreateBidData, PaginatedResult, SortParams } from '../../interfaces/types.js';

const mapToInterface = (doc: any): IBid => ({
  id: doc._id.toString(),
  auctionId: doc.auctionId?.toString() || doc.auctionId,
  carId: doc.carId?.toString() || doc.carId,
  userId: doc.userId?.toString() || doc.userId,
  amount: doc.amount,
  isWinning: doc.isWinning,
  placedAt: doc.placedAt,
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
});

const mapWithDetails = (doc: any): IBidWithDetails => {
  const bid = mapToInterface(doc);
  const result: IBidWithDetails = { ...bid };

  if (doc.auctionId && typeof doc.auctionId === 'object') {
    result.auction = {
      id: doc.auctionId._id.toString(),
      name: doc.auctionId.name,
      status: doc.auctionId.status,
    };
    result.auctionId = doc.auctionId._id.toString();
  }

  if (doc.carId && typeof doc.carId === 'object') {
    result.car = {
      id: doc.carId._id.toString(),
      VIN: doc.carId.VIN,
      brand: doc.carId.brand,
      model: doc.carId.model,
      year: doc.carId.year,
    };
    result.carId = doc.carId._id.toString();
  }

  if (doc.userId && typeof doc.userId === 'object') {
    result.user = {
      id: doc.userId._id.toString(),
      name: doc.userId.name,
      email: doc.userId.email,
    };
    result.userId = doc.userId._id.toString();
  }

  return result;
};

const buildMongoFilters = (filters: BidFilters): Record<string, any> => {
  const mongoFilters: Record<string, any> = {};

  if (filters.auctionId) mongoFilters.auctionId = filters.auctionId;
  if (filters.carId) mongoFilters.carId = filters.carId;
  if (filters.userId) mongoFilters.userId = filters.userId;
  if (filters.isWinning !== undefined) mongoFilters.isWinning = filters.isWinning;

  if (filters.minAmount !== undefined || filters.maxAmount !== undefined) {
    mongoFilters.amount = {};
    if (filters.minAmount !== undefined) mongoFilters.amount.$gte = filters.minAmount;
    if (filters.maxAmount !== undefined) mongoFilters.amount.$lte = filters.maxAmount;
  }

  return mongoFilters;
};

export const createMongoBidRepository = (): IBidRepository => ({
  async findById(id) {
    const bid = await Bid.findById(id);
    return bid ? mapToInterface(bid) : null;
  },

  async findByIdWithDetails(id) {
    const bid = await Bid.findById(id)
      .populate('auctionId', 'name startDate endDate isClosed')
      .populate('carId', 'VIN brand model year')
      .populate('userId', 'name email');
    return bid ? mapWithDetails(bid) : null;
  },

  async create(data) {
    const bid = await Bid.create({
      ...data,
      placedAt: new Date(),
    });
    return mapToInterface(bid);
  },

  async update(id, data) {
    const bid = await Bid.findByIdAndUpdate(id, data, { new: true });
    return bid ? mapToInterface(bid) : null;
  },

  async delete(id) {
    const result = await Bid.findByIdAndDelete(id);
    return !!result;
  },

  async findAll(filters, pagination, sort) {
    const mongoFilters = buildMongoFilters(filters);
    const total = await Bid.countDocuments(mongoFilters);

    const bids = await Bid.find(mongoFilters)
      .sort({ [sort.sortField]: sort.sortOrder })
      .skip(pagination.skip)
      .limit(pagination.limit)
      .populate('auctionId', 'name startDate endDate isClosed')
      .populate('carId', 'VIN brand model year')
      .populate('userId', 'name email');

    return {
      data: bids.map(mapWithDetails),
      total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: Math.ceil(total / pagination.limit),
    };
  },

  async count(filters) {
    const mongoFilters = buildMongoFilters(filters);
    return Bid.countDocuments(mongoFilters);
  },

  async findExisting(auctionId, carId, userId) {
    const bid = await Bid.findOne({ auctionId, carId, userId });
    return bid ? mapToInterface(bid) : null;
  },

  async findHighestForCar(auctionId, carId) {
    const bid = await Bid.findOne({ auctionId, carId }).sort({ amount: -1 });
    return bid ? mapToInterface(bid) : null;
  },

  async findByAuction(auctionId) {
    const bids = await Bid.find({ auctionId });
    return bids.map(mapToInterface);
  },

  async findByAuctionAndCar(auctionId, carId) {
    const bids = await Bid.find({ auctionId, carId }).sort({ amount: -1 });
    return bids.map(mapToInterface);
  },

  async setWinning(bidId, isWinning) {
    const bid = await Bid.findByIdAndUpdate(bidId, { isWinning }, { new: true });
    return bid ? mapToInterface(bid) : null;
  },

  async resetWinningForAuction(auctionId) {
    const result = await Bid.updateMany({ auctionId }, { isWinning: false });
    return result.modifiedCount;
  },

  async countByAuction(auctionId) {
    return Bid.countDocuments({ auctionId });
  },

  async deleteByAuction(auctionId) {
    const result = await Bid.deleteMany({ auctionId });
    return result.deletedCount;
  },
});

