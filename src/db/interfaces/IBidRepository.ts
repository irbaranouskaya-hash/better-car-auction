import type { IBid, CreateBidData, PaginatedResult, SortParams } from './types.js';

export interface BidFilters {
  auctionId?: string;
  carId?: string;
  userId?: string;
  isWinning?: boolean;
  minAmount?: number;
  maxAmount?: number;
}

export interface IBidWithDetails extends IBid {
  auction?: {
    id: string;
    name: string;
    status: string;
  };
  car?: {
    id: string;
    VIN: string;
    brand: string;
    model: string;
    year: number;
  };
  user?: {
    id: string;
    name: string;
    email: string;
  };
}

export interface IBidRepository {
  findById(id: string): Promise<IBid | null>;
  findByIdWithDetails(id: string): Promise<IBidWithDetails | null>;
  create(data: CreateBidData): Promise<IBid>;
  update(id: string, data: Partial<IBid>): Promise<IBid | null>;
  delete(id: string): Promise<boolean>;
  findAll(
    filters: BidFilters,
    pagination: { page: number; limit: number; skip: number },
    sort: SortParams
  ): Promise<PaginatedResult<IBidWithDetails>>;
  count(filters: BidFilters): Promise<number>;
  findExisting(auctionId: string, carId: string, userId: string): Promise<IBid | null>;
  findHighestForCar(auctionId: string, carId: string): Promise<IBid | null>;
  findByAuction(auctionId: string): Promise<IBid[]>;
  findByAuctionAndCar(auctionId: string, carId: string): Promise<IBid[]>;
  setWinning(bidId: string, isWinning: boolean): Promise<IBid | null>;
  resetWinningForAuction(auctionId: string): Promise<number>;
  countByAuction(auctionId: string): Promise<number>;
  deleteByAuction(auctionId: string): Promise<number>;
}

