export interface IUser {
  id: string;
  name: string;
  email: string;
  password: string;
  role: 'user' | 'admin';
  tokenVersion: number;
  passwordChangedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICar {
  id: string;
  userId: string;
  VIN: string;
  brand: string;
  model: string;
  odometerValue: number;
  year: number;
  exteriorColor: string;
  interiorColor: string;
  haveStrongScratches: boolean;
  haveSmallScratches: boolean;
  haveMalfunctions: boolean;
  haveElectricFailures: boolean;
  msrp: number;
  grade: number;
  optimizedPrice: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IAuction {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  createdBy: string;
  cars: string[];
  isClosed: boolean;
  status: 'upcoming' | 'active' | 'ended' | 'closed';
  durationHours: number;
  timeUntilStart: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IBid {
  id: string;
  auctionId: string;
  carId: string;
  userId: string;
  amount: number;
  isWinning: boolean;
  placedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface SortParams {
  sortField: string;
  sortOrder: 1 | -1;
}

export type CreateUserData = Omit<IUser, 'id' | 'createdAt' | 'updatedAt' | 'tokenVersion' | 'passwordChangedAt'> & {
  tokenVersion?: number;
};

export type CreateCarData = Omit<ICar, 'id' | 'createdAt' | 'updatedAt' | 'grade' | 'optimizedPrice'>;

export type CreateAuctionData = Omit<IAuction, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'durationHours' | 'timeUntilStart' | 'isClosed'>;

export type CreateBidData = Omit<IBid, 'id' | 'createdAt' | 'updatedAt' | 'isWinning' | 'placedAt'>;

