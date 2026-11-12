import { z } from 'zod';

export const ListCustomersQuery = z.object({
  search: z.string().trim().max(120).optional(),
  segment: z.enum(['NEW', 'ACTIVE', 'LOYAL', 'AT_RISK', 'LOST']).optional(),
  sort: z.enum(['lastStamp', 'totalStamps', 'name']).optional().default('lastStamp'),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});
export type ListCustomersQuery = z.infer<typeof ListCustomersQuery>;