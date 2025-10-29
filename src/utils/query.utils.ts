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

export const buildCarFilters = (query: Request["query"]): Record<string, any> => {
  const filters: Record<string, any> = {};

  const userId = getQueryString(query.userId);
  const VIN = getQueryString(query.VIN);
  const exteriorColor = getQueryString(query.exteriorColor);
  const interiorColor = getQueryString(query.interiorColor);

  if (userId) filters.userId = userId;
  if (VIN) filters.VIN = VIN;
  if (exteriorColor) filters.exteriorColor = exteriorColor;
  if (interiorColor) filters.interiorColor = interiorColor;

  const odometerValue = getQueryNumber(query.odometerValue);
  const year = getQueryNumber(query.year);

  if (odometerValue !== undefined) filters.odometerValue = odometerValue;
  if (year !== undefined) filters.year = year;

  const minOdometer = getQueryNumber(query.minOdometer);
  const maxOdometer = getQueryNumber(query.maxOdometer);
  const minYear = getQueryNumber(query.minYear);
  const maxYear = getQueryNumber(query.maxYear);

  if (minOdometer !== undefined || maxOdometer !== undefined) {
    filters.odometerValue = {};
    if (minOdometer !== undefined) filters.odometerValue.$gte = minOdometer;
    if (maxOdometer !== undefined) filters.odometerValue.$lte = maxOdometer;
  }

  if (minYear !== undefined || maxYear !== undefined) {
    filters.year = {};
    if (minYear !== undefined) filters.year.$gte = minYear;
    if (maxYear !== undefined) filters.year.$lte = maxYear;
  }

  const haveStrongScratches = getQueryBoolean(query.haveStrongScratches);
  const haveSmallScratches = getQueryBoolean(query.haveSmallScratches);
  const haveMalfunctions = getQueryBoolean(query.haveMalfunctions);
  const haveElectricFailures = getQueryBoolean(query.haveElectricFailures);

  if (haveStrongScratches !== undefined) filters.haveStrongScratches = haveStrongScratches;
  if (haveSmallScratches !== undefined) filters.haveSmallScratches = haveSmallScratches;
  if (haveMalfunctions !== undefined) filters.haveMalfunctions = haveMalfunctions;
  if (haveElectricFailures !== undefined) filters.haveElectricFailures = haveElectricFailures;

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
  const order = getQueryString(query.order);

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

