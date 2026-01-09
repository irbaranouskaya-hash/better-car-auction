import { z } from 'zod';

const idSchema = z.string().refine(
  (val) => /^[0-9a-fA-F]{24}$/.test(val) || /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(val),
  "Invalid ID format"
);

export const createBidSchema = z.object({
  carId: idSchema,
  
  amount: z.number()
    .int("Bid amount must be an integer")
    .positive("Bid amount must be positive")
    .min(1, "Bid amount must be at least $1")
    .max(10000000, "Bid amount cannot exceed $10,000,000")
});

export const assignCarsSchema = z.object({
  carIds: z.array(idSchema)
  .min(1, "At least one car must be assigned")
  .max(100, "Cannot assign more than 100 cars at once")
});

export const getBidsQuerySchema = z.object({
  auctionId: idSchema.optional(),
  
  carId: idSchema.optional(),
  
  userId: idSchema.optional(),
  
  page: z.string()
    .optional()
    .transform(val => val ? parseInt(val, 10) : 1)
    .pipe(z.number().int().min(1)),
  
  limit: z.string()
    .optional()
    .transform(val => val ? parseInt(val, 10) : 20)
    .pipe(z.number().int().min(1).max(100)),
  
  sortBy: z.enum(['amount', 'placedAt', 'createdAt'])
    .optional()
    .default('amount'),
  
  sortOrder: z.enum(['asc', 'desc'])
    .optional()
    .default('desc')
}).strict();

export type CreateBidInput = z.infer<typeof createBidSchema>;
export type AssignCarsInput = z.infer<typeof assignCarsSchema>;
export type GetBidsQuery = z.infer<typeof getBidsQuerySchema>;