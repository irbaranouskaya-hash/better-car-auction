import Car from '../../../models/Car.model.js';
import type { ICarRepository, CarFilters } from '../../interfaces/ICarRepository.js';
import type { ICar, CreateCarData, PaginatedResult, SortParams } from '../../interfaces/types.js';

const mapToInterface = (doc: any): ICar => ({
  id: doc._id.toString(),
  userId: doc.userId?.toString() || doc.userId,
  VIN: doc.VIN,
  brand: doc.brand,
  model: doc.model,
  odometerValue: doc.odometerValue,
  year: doc.year,
  exteriorColor: doc.exteriorColor,
  interiorColor: doc.interiorColor,
  haveStrongScratches: doc.haveStrongScratches,
  haveSmallScratches: doc.haveSmallScratches,
  haveMalfunctions: doc.haveMalfunctions,
  haveElectricFailures: doc.haveElectricFailures,
  msrp: doc.msrp,
  grade: doc.grade,
  optimizedPrice: doc.optimizedPrice,
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
});

const mapWithOwner = (doc: any): ICar & { user?: { name: string; email: string } } => {
  const car = mapToInterface(doc);
  if (doc.userId && typeof doc.userId === 'object') {
    return {
      ...car,
      user: {
        name: doc.userId.name,
        email: doc.userId.email,
      },
    };
  }
  return car;
};

const buildMongoFilters = (filters: CarFilters): Record<string, any> => {
  const mongoFilters: Record<string, any> = {};

  if (filters.userId) mongoFilters.userId = filters.userId;
  if (filters.VIN) mongoFilters.VIN = filters.VIN;
  if (filters.brand) mongoFilters.brand = { $regex: filters.brand, $options: 'i' };
  if (filters.model) mongoFilters.model = { $regex: filters.model, $options: 'i' };
  if (filters.exteriorColor) mongoFilters.exteriorColor = filters.exteriorColor;
  if (filters.interiorColor) mongoFilters.interiorColor = filters.interiorColor;

  if (filters.odometerValue !== undefined) mongoFilters.odometerValue = filters.odometerValue;
  if (filters.year !== undefined) mongoFilters.year = filters.year;

  if (filters.minOdometer !== undefined || filters.maxOdometer !== undefined) {
    mongoFilters.odometerValue = {};
    if (filters.minOdometer !== undefined) mongoFilters.odometerValue.$gte = filters.minOdometer;
    if (filters.maxOdometer !== undefined) mongoFilters.odometerValue.$lte = filters.maxOdometer;
  }

  if (filters.minYear !== undefined || filters.maxYear !== undefined) {
    mongoFilters.year = {};
    if (filters.minYear !== undefined) mongoFilters.year.$gte = filters.minYear;
    if (filters.maxYear !== undefined) mongoFilters.year.$lte = filters.maxYear;
  }

  if (filters.haveStrongScratches !== undefined) mongoFilters.haveStrongScratches = filters.haveStrongScratches;
  if (filters.haveSmallScratches !== undefined) mongoFilters.haveSmallScratches = filters.haveSmallScratches;
  if (filters.haveMalfunctions !== undefined) mongoFilters.haveMalfunctions = filters.haveMalfunctions;
  if (filters.haveElectricFailures !== undefined) mongoFilters.haveElectricFailures = filters.haveElectricFailures;

  return mongoFilters;
};

export const createMongoCarRepository = (): ICarRepository => ({
  async findById(id) {
    const car = await Car.findById(id);
    return car ? mapToInterface(car) : null;
  },

  async findByIdWithOwner(id) {
    const car = await Car.findById(id).populate('userId', 'name email');
    return car ? mapWithOwner(car) : null;
  },

  async findByVIN(vin) {
    const car = await Car.findOne({ VIN: vin });
    return car ? mapToInterface(car) : null;
  },

  async findByVINExcluding(vin, excludeId) {
    const car = await Car.findOne({ VIN: vin, _id: { $ne: excludeId } });
    return car ? mapToInterface(car) : null;
  },

  async create(data) {
    const car = await Car.create(data);
    return mapToInterface(car);
  },

  async update(id, data) {
    const car = await Car.findByIdAndUpdate(id, data, { new: true, runValidators: true });
    return car ? mapToInterface(car) : null;
  },

  async delete(id) {
    const result = await Car.findByIdAndDelete(id);
    return !!result;
  },

  async findAll(filters, pagination, sort) {
    const mongoFilters = buildMongoFilters(filters);
    const total = await Car.countDocuments(mongoFilters);

    const cars = await Car.find(mongoFilters)
      .sort({ [sort.sortField]: sort.sortOrder })
      .skip(pagination.skip)
      .limit(pagination.limit)
      .populate('userId', 'name email');

    return {
      data: cars.map(mapWithOwner),
      total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: Math.ceil(total / pagination.limit),
    };
  },

  async count(filters) {
    const mongoFilters = buildMongoFilters(filters);
    return Car.countDocuments(mongoFilters);
  },

  async findSimilar(year, odometerValue, excludeId, limit) {
    const SIMILAR_YEAR_RANGE = 2;
    const SIMILAR_ODOMETER_RANGE = 0.2;

    const cars = await Car.find({
      year: {
        $gte: year - SIMILAR_YEAR_RANGE,
        $lte: year + SIMILAR_YEAR_RANGE,
      },
      odometerValue: {
        $gte: odometerValue * (1 - SIMILAR_ODOMETER_RANGE),
        $lte: odometerValue * (1 + SIMILAR_ODOMETER_RANGE),
      },
      _id: { $ne: excludeId },
    }).limit(limit);

    return cars.map(mapToInterface);
  },
});

