import { type Request } from "express";

export const getQueryString = (value: any): string | undefined => {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && value.length > 0) return value[0];
  return undefined;
};

export const getQueryNumber = (value: any): number | undefined => {
  const str = getQueryString(value);
  if (!str) return undefined;
  const num = parseInt(str, 10);
  return isNaN(num) ? undefined : num;
};

export const getQueryBoolean = (value: any): boolean | undefined => {
  const str = getQueryString(value);
  if (!str) return undefined;
  if (str === "true" || str === "1") return true;
  if (str === "false" || str === "0") return false;
  return undefined;
};

export const buildCarFilters = (query: any): Record<string, any> => {
  const filters: Record<string, any> = {};

  if (query.userId) filters.userId = query.userId;
  if (query.VIN) filters.VIN = query.VIN;
  if (query.exteriorColor) filters.exteriorColor = query.exteriorColor;
  if (query.interiorColor) filters.interiorColor = query.interiorColor;

  if (query.odometerValue !== undefined) filters.odometerValue = query.odometerValue;
  if (query.year !== undefined) filters.year = query.year;

  if (query.minOdometer !== undefined || query.maxOdometer !== undefined) {
    filters.odometerValue = {};
    if (query.minOdometer !== undefined) filters.odometerValue.$gte = query.minOdometer;
    if (query.maxOdometer !== undefined) filters.odometerValue.$lte = query.maxOdometer;
  }

  if (query.minYear !== undefined || query.maxYear !== undefined) {
    filters.year = {};
    if (query.minYear !== undefined) filters.year.$gte = query.minYear;
    if (query.maxYear !== undefined) filters.year.$lte = query.maxYear;
  }

  if (query.haveStrongScratches !== undefined) filters.haveStrongScratches = query.haveStrongScratches;
  if (query.haveSmallScratches !== undefined) filters.haveSmallScratches = query.haveSmallScratches;
  if (query.haveMalfunctions !== undefined) filters.haveMalfunctions = query.haveMalfunctions;
  if (query.haveElectricFailures !== undefined) filters.haveElectricFailures = query.haveElectricFailures;

  return filters;
};

export interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
}

export const getPaginationParams = (
  query: Request["query"],
  defaultLimit: number = 10,
  maxLimit: number = 100
): PaginationParams => {
  let page = getQueryNumber(query.page) || 1;
  let limit = getQueryNumber(query.limit) || defaultLimit;

  if (page < 1) page = 1;
  if (limit < 1) limit = defaultLimit;
  if (limit > maxLimit) limit = maxLimit;

  const skip = (page - 1) * limit;

  return { page, limit, skip };
};

export interface SortParams {
  sortField: string;
  sortOrder: 1 | -1;
}

export const getSortParams = (
  query: Request["query"],
  allowedFields: string[] = [],
  defaultField: string = "createdAt"
): SortParams => {
  const sortBy = getQueryString(query.sortBy) || defaultField;
  const order = getQueryString(query.sortOrder) || getQueryString(query.order);

  const sortField = allowedFields.length > 0 && !allowedFields.includes(sortBy) 
    ? defaultField 
    : sortBy;

  const sortOrder = order === "asc" ? 1 : -1;

  return { sortField, sortOrder };
};

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export const createPaginatedResponse = <T>(
  data: T[],
  total: number,
  pagination: PaginationParams
): PaginatedResponse<T> => {
  const totalPages = Math.ceil(total / pagination.limit);

  return {
    data,
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total,
      totalPages,
      hasNextPage: pagination.page < totalPages,
      hasPrevPage: pagination.page > 1,
    },
  };
};

