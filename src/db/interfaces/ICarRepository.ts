import type { ICar, CreateCarData, PaginatedResult, SortParams } from './types.js';

export interface CarFilters {
  userId?: string;
  VIN?: string;
  brand?: string;
  model?: string;
  exteriorColor?: string;
  interiorColor?: string;
  odometerValue?: number;
  year?: number;
  minOdometer?: number;
  maxOdometer?: number;
  minYear?: number;
  maxYear?: number;
  haveStrongScratches?: boolean;
  haveSmallScratches?: boolean;
  haveMalfunctions?: boolean;
  haveElectricFailures?: boolean;
}

export interface ICarRepository {
  findById(id: string): Promise<ICar | null>;
  findByIdWithOwner(id: string): Promise<(ICar & { user?: { name: string; email: string } }) | null>;
  findByVIN(vin: string): Promise<ICar | null>;
  findByVINExcluding(vin: string, excludeId: string): Promise<ICar | null>;
  create(data: CreateCarData): Promise<ICar>;
  update(id: string, data: Partial<CreateCarData>): Promise<ICar | null>;
  delete(id: string): Promise<boolean>;
  findAll(
    filters: CarFilters,
    pagination: { page: number; limit: number; skip: number },
    sort: SortParams
  ): Promise<PaginatedResult<ICar & { user?: { name: string; email: string } }>>;
  count(filters: CarFilters): Promise<number>;
  findSimilar(year: number, odometerValue: number, excludeId: string, limit: number): Promise<ICar[]>;
}

