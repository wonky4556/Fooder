import { z } from 'zod';

export const createScheduleSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().default(''),
  pickupInstructions: z.string().default(''),
  startTime: z.string().datetime({ message: 'startTime must be a valid ISO datetime' }),
  endTime: z.string().datetime({ message: 'endTime must be a valid ISO datetime' }),
  items: z.array(z.object({
    menuItemId: z.string().min(1),
    totalQuantity: z.number().int().positive('Quantity must be a positive integer'),
  })).min(1, 'At least one item is required'),
}).refine((data) => new Date(data.endTime) > new Date(data.startTime), {
  message: 'endTime must be after startTime',
  path: ['endTime'],
});

export const updateScheduleSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  pickupInstructions: z.string().optional(),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
  status: z.enum(['draft', 'active', 'closed']).optional(),
});
