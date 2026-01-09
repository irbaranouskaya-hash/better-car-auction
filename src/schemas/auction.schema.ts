import { z } from 'zod';

export const createAuctionSchema = z.object({
  name: z.string()
    .min(3, "Auction name must be at least 3 characters")
    .max(100, "Auction name must not exceed 100 characters")
    .trim(),
  
  startDate: z.string()
    .datetime("Invalid start date format")
    .or(z.date())
    .transform((val) => new Date(val))
    .refine((date) => date >= new Date(), {
      message: "Start date cannot be in the past"
    }),
  
  endDate: z.string()
    .datetime("Invalid end date format")
    .or(z.date())
    .transform((val) => new Date(val))
}).refine((data) => data.endDate > data.startDate, {
  message: "End date must be after start date",
  path: ["endDate"]
});

export const updateAuctionSchema = z.object({
  name: z.string()
    .min(3, "Auction name must be at least 3 characters")
    .max(100, "Auction name must not exceed 100 characters")
    .trim()
    .optional(),
  
  startDate: z.string()
    .datetime("Invalid start date format")
    .or(z.date())
    .transform((val) => new Date(val))
    .optional(),
  
  endDate: z.string()
    .datetime("Invalid end date format")
    .or(z.date())
    .transform((val) => new Date(val))
    .optional()
}).refine(
  (data) => {
    if (data.startDate && data.endDate) {
      return data.endDate > data.startDate;
    }
    return true;
  },
  {
    message: "End date must be after start date",
    path: ["endDate"]
  }
).refine(
  (data) => Object.keys(data).length > 0,
  { message: "At least one field is required for update" }
);

export const getAuctionsQuerySchema = z.object({
  status: z.enum(['upcoming', 'active', 'ended', 'all'])
    .default('all'),
  
  page: z.coerce.number()
    .int()
    .min(1)
    .max(1000)
    .default(1),
  
  limit: z.coerce.number()
    .int()
    .min(1)
    .max(100)
    .default(10),
  
  sortBy: z.enum(['name', 'startDate', 'endDate', 'createdAt'])
    .default('startDate'),
  
  sortOrder: z.enum(['asc', 'desc'])
    .default('desc'),
  
  createdBy: z.string()
    .refine(
      (val) => /^[0-9a-fA-F]{24}$/.test(val) || /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(val),
      "Invalid user ID format"
    )
    .optional(),
  
  search: z.string()
    .max(100, "Search query too long")
    .optional()
});

export type CreateAuctionInput = z.infer<typeof createAuctionSchema>;
export type UpdateAuctionInput = z.infer<typeof updateAuctionSchema>;
export type GetAuctionsQuery = z.infer<typeof getAuctionsQuerySchema>;