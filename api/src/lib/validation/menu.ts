import { z } from 'zod';

export const createMenuItemSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().default(''),
  price: z.number().positive('Price must be positive'),
  imageUrl: z.string().url().optional(),
  category: z.string().min(1, 'Category is required'),
});

export const updateMenuItemSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  price: z.number().positive('Price must be positive').optional(),
  imageUrl: z.string().url().optional(),
  category: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
});
