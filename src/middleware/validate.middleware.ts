// src/middleware/validate.middleware.ts
import { type Request, type Response, type NextFunction } from 'express';
import { z, ZodError } from 'zod';

export const validate = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.issues.map((err) => ({
          field: err.path.join('.'),
          message: err.message
        }));

        res.status(400).json({
          success: false,
          message: "Validation error",
          errors: errors
        });
        return;
      }

      res.status(500).json({
        success: false,
        message: "Internal server error"
      });
    }
  };
};