import Auction from '../../../models/Auction.model.js';
import type { IAuctionRepository, AuctionFilters, IAuctionWithCars } from '../../interfaces/IAuctionRepository.js';
import type { IAuction, CreateAuctionData, PaginatedResult, SortParams } from '../../interfaces/types.js';

const mapToInterface = (doc: any): IAuction => ({
  id: doc._id.toString(),
  name: doc.name,
  startDate: doc.startDate,
  endDate: doc.endDate,
  createdBy: doc.createdBy?.toString() || doc.createdBy,
  cars: (doc.cars || []).map((c: any) => c?.toString() || c),
  isClosed: doc.isClosed,
  status: doc.status,
  durationHours: doc.durationHours,
  timeUntilStart: doc.timeUntilStart,
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
});

const mapWithDetails = (doc: any): IAuctionWithCars => {
  const auction = mapToInterface(doc);
  const result: IAuctionWithCars = { ...auction };

  if (doc.cars && doc.cars.length > 0 && typeof doc.cars[0] === 'object') {
    result.carsData = doc.cars.map((car: any) => ({
      id: car._id.toString(),
      VIN: car.VIN,
      brand: car.brand,
      model: car.model,
      year: car.year,
      msrp: car.msrp,
      grade: car.grade,
      optimizedPrice: car.optimizedPrice,
    }));
    result.cars = doc.cars.map((car: any) => car._id.toString());
  }

  if (doc.createdBy && typeof doc.createdBy === 'object') {
    result.creator = {
      id: doc.createdBy._id.toString(),
      name: doc.createdBy.name,
      email: doc.createdBy.email,
    };
    result.createdBy = doc.createdBy._id.toString();
  }

  return result;
};

const buildMongoFilters = (filters: AuctionFilters): Record<string, any> => {
  const mongoFilters: Record<string, any> = {};
  const now = new Date();

  if (filters.createdBy) mongoFilters.createdBy = filters.createdBy;
  if (filters.name) mongoFilters.name = { $regex: filters.name, $options: 'i' };
  if (filters.isClosed !== undefined) mongoFilters.isClosed = filters.isClosed;

  if (filters.status === 'closed') {
    mongoFilters.isClosed = true;
  } else if (filters.status === 'upcoming') {
    mongoFilters.startDate = { $gt: now };
    mongoFilters.isClosed = false;
  } else if (filters.status === 'active') {
    mongoFilters.startDate = { $lte: now };
    mongoFilters.endDate = { $gte: now };
    mongoFilters.isClosed = false;
  } else if (filters.status === 'ended') {
    mongoFilters.endDate = { $lt: now };
    mongoFilters.isClosed = false;
  }

  if (filters.startDateGt) {
    mongoFilters.startDate = { ...mongoFilters.startDate, $gt: filters.startDateGt };
  }
  if (filters.startDateLte) {
    mongoFilters.startDate = { ...mongoFilters.startDate, $lte: filters.startDateLte };
  }
  if (filters.endDateGte) {
    mongoFilters.endDate = { ...mongoFilters.endDate, $gte: filters.endDateGte };
  }
  if (filters.endDateLt) {
    mongoFilters.endDate = { ...mongoFilters.endDate, $lt: filters.endDateLt };
  }

  return mongoFilters;
};

export const createMongoAuctionRepository = (): IAuctionRepository => ({
  async findById(id) {
    const auction = await Auction.findById(id);
    return auction ? mapToInterface(auction) : null;
  },

  async findByIdWithDetails(id) {
    const auction = await Auction.findById(id)
      .populate('cars')
      .populate('createdBy', 'name email');
    return auction ? mapWithDetails(auction) : null;
  },

  async create(data) {
    const auction = await Auction.create(data);
    return mapToInterface(auction);
  },

  async update(id, data) {
    const auction = await Auction.findByIdAndUpdate(id, data, { new: true, runValidators: true });
    return auction ? mapToInterface(auction) : null;
  },

  async delete(id) {
    const result = await Auction.findByIdAndDelete(id);
    return !!result;
  },

  async findAll(filters, pagination, sort) {
    const mongoFilters = buildMongoFilters(filters);
    const total = await Auction.countDocuments(mongoFilters);

    const auctions = await Auction.find(mongoFilters)
      .sort({ [sort.sortField]: sort.sortOrder })
      .skip(pagination.skip)
      .limit(pagination.limit)
      .populate('cars')
      .populate('createdBy', 'name email');

    return {
      data: auctions.map(mapWithDetails),
      total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: Math.ceil(total / pagination.limit),
    };
  },

  async count(filters) {
    const mongoFilters = buildMongoFilters(filters);
    return Auction.countDocuments(mongoFilters);
  },

  async findOverlapping(startDate, endDate, excludeId) {
    const query: any = {
      $or: [
        { startDate: { $lte: startDate }, endDate: { $gte: startDate } },
        { startDate: { $lte: endDate }, endDate: { $gte: endDate } },
        { startDate: { $gte: startDate }, endDate: { $lte: endDate } },
      ],
    };

    if (excludeId) {
      query._id = { $ne: excludeId };
    }

    const auction = await Auction.findOne(query);
    return auction ? mapToInterface(auction) : null;
  },

  async findExpired() {
    const now = new Date();
    const auctions = await Auction.find({
      endDate: { $lt: now },
      isClosed: false,
    }).sort({ endDate: 1 });

    return auctions.map(mapToInterface);
  },

  async close(id) {
    const auction = await Auction.findByIdAndUpdate(
      id,
      { isClosed: true },
      { new: true }
    );
    return auction ? mapToInterface(auction) : null;
  },

  async addCar(auctionId, carId) {
    const auction = await Auction.findByIdAndUpdate(
      auctionId,
      { $addToSet: { cars: carId } },
      { new: true }
    );
    return auction ? mapToInterface(auction) : null;
  },

  async removeCar(auctionId, carId) {
    const auction = await Auction.findByIdAndUpdate(
      auctionId,
      { $pull: { cars: carId } },
      { new: true }
    );
    return auction ? mapToInterface(auction) : null;
  },
});

