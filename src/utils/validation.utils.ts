import { type Response } from "express";
import mongoose from "mongoose";


export const isValidObjectId = (id: string): boolean => {
  return mongoose.Types.ObjectId.isValid(id);
};

export const sendErrorResponse = (
  res: Response,
  statusCode: number,
  message: string,
  error?: string
): void => {
  const response: any = {
    success: false,
    message,
  };
  
  if (error) {
    response.error = error;
  }
  
  res.status(statusCode).json(response);
};

export const sendSuccessResponse = (
  res: Response,
  statusCode: number,
  message: string,
  data?: any
): void => {
  const response: any = {
    success: true,
    message,
  };
  
  if (data !== undefined) {
    response.data = data;
  }
  
  res.status(statusCode).json(response);
};

export const validateIdParam = (
  id: string | undefined,
  res: Response,
  resourceName: string = "Resource"
): boolean => {
  if (!id || !isValidObjectId(id)) {
    sendErrorResponse(res, 400, `Invalid ${resourceName} ID`);
    return false;
  }
  return true;
};

export const handleControllerError = (
  error: unknown,
  res: Response,
  operation: string
): void => {
  console.error(`${operation} error:`, error);
  sendErrorResponse(
    res,
    500,
    `Server error during ${operation}`,
    error instanceof Error ? error.message : "Unknown error"
  );
};

