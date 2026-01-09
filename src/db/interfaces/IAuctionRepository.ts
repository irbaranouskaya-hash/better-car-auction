import type { IAuction, CreateAuctionData, PaginatedResult, SortParams } from './types.js';

export interface AuctionFilters {
  status?: 'upcoming' | 'active' | 'ended' | 'closed';
  createdBy?: string;
  name?: string;
  isClosed?: boolean;
  startDateGt?: Date;
  startDateLte?: Date;
  endDateGte?: Date;
  endDateLt?: Date;
}

export interface IAuctionWithCars extends IAuction {
  carsData?: Array<{
    id: string;
    VIN: string;
    brand: string;
    model: string;
    year: number;
    msrp: number;
    grade: number;
    optimizedPrice: number;
  }>;
  creator?: {
    id: string;
    name: string;
    email: string;
  };
}

export interface IAuctionRepository {
  findById(id: string): Promise<IAuction | null>;
  findByIdWithDetails(id: string): Promise<IAuctionWithCars | null>;
  create(data: CreateAuctionData): Promise<IAuction>;
  update(id: string, data: Partial<CreateAuctionData & { isClosed: boolean }>): Promise<IAuction | null>;
  delete(id: string): Promise<boolean>;
  findAll(
    filters: AuctionFilters,
    pagination: { page: number; limit: number; skip: number },
    sort: SortParams
  ): Promise<PaginatedResult<IAuctionWithCars>>;
  count(filters: AuctionFilters): Promise<number>;
  findOverlapping(startDate: Date, endDate: Date, excludeId?: string): Promise<IAuction | null>;
  findExpired(): Promise<IAuction[]>;
  close(id: string): Promise<IAuction | null>;
  addCar(auctionId: string, carId: string): Promise<IAuction | null>;
  removeCar(auctionId: string, carId: string): Promise<IAuction | null>;
}

