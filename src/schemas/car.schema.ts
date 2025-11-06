import { z } from 'zod';

export const createCarSchema = z.object({
  VIN: z.string()
    .min(17, "VIN must be exactly 17 characters")
    .max(17, "VIN must be exactly 17 characters")
    .regex(/^[A-HJ-NPR-Z0-9]{17}$/, "Invalid VIN format"),
  
  odometerValue: z.number()
    .int("Odometer value must be an integer")
    .min(0, "Odometer value cannot be negative")
    .max(1000000, "Odometer value seems unrealistic"),
  
  year: z.number()
    .int("Year must be an integer")
    .min(1900, "Year must be 1900 or later")
    .max(new Date().getFullYear() + 1, "Year cannot be in the future"),
  
  exteriorColor: z.string()
    .min(2, "Exterior color must be at least 2 characters")
    .max(50, "Exterior color must be at most 50 characters")
    .trim(),
  
  interiorColor: z.string()
    .min(2, "Interior color must be at least 2 characters")
    .max(50, "Interior color must be at most 50 characters")
    .trim(),
  
  haveStrongScratches: z.boolean({error: "haveStrongScratches is required"}),
  
  haveSmallScratches: z.boolean({error: "haveSmallScratches is required",}),
  
  haveMalfunctions: z.boolean({error: "haveMalfunctions is required",}),
  
  haveElectricFailures: z.boolean({error: "haveElectricFailures is required"}),

  msrp: z.number()
    .positive("MSRP must be a positive number")
    .min(1000, "MSRP must be at least $1,000")
    .max(10000000, "MSRP cannot exceed $10,000,000"),
});

export const updateCarSchema = createCarSchema.partial()
  .refine(
    (data) => Object.keys(data).length > 0,
    { message: "At least one field is required for update" }
  );

export type CreateCarInput = z.infer<typeof createCarSchema>;
export type UpdateCarInput = z.infer<typeof updateCarSchema>;