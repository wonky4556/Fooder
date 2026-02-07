import { describe, it, expect } from 'vitest';
import { createMenuItemSchema, updateMenuItemSchema } from '../menu.js';

describe('createMenuItemSchema', () => {
  it('accepts valid input with all fields', () => {
    const result = createMenuItemSchema.safeParse({
      name: 'Margherita Pizza',
      description: 'Classic tomato and mozzarella',
      price: 12.99,
      imageUrl: 'https://example.com/pizza.jpg',
      category: 'main',
    });
    expect(result.success).toBe(true);
  });

  it('accepts valid input with only required fields', () => {
    const result = createMenuItemSchema.safeParse({
      name: 'Garlic Bread',
      price: 4.50,
      category: 'sides',
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty name', () => {
    const result = createMenuItemSchema.safeParse({
      name: '',
      price: 10,
      category: 'main',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing price', () => {
    const result = createMenuItemSchema.safeParse({
      name: 'Test Item',
      category: 'main',
    });
    expect(result.success).toBe(false);
  });

  it('rejects negative price', () => {
    const result = createMenuItemSchema.safeParse({
      name: 'Test Item',
      price: -5,
      category: 'main',
    });
    expect(result.success).toBe(false);
  });

  it('rejects zero price', () => {
    const result = createMenuItemSchema.safeParse({
      name: 'Test Item',
      price: 0,
      category: 'main',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing category', () => {
    const result = createMenuItemSchema.safeParse({
      name: 'Test Item',
      price: 10,
    });
    expect(result.success).toBe(false);
  });
});

describe('updateMenuItemSchema', () => {
  it('accepts partial updates', () => {
    const result = updateMenuItemSchema.safeParse({
      name: 'Updated Name',
    });
    expect(result.success).toBe(true);
  });

  it('accepts empty object (all optional)', () => {
    const result = updateMenuItemSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('rejects negative price if provided', () => {
    const result = updateMenuItemSchema.safeParse({
      price: -1,
    });
    expect(result.success).toBe(false);
  });

  it('accepts isActive boolean', () => {
    const result = updateMenuItemSchema.safeParse({
      isActive: false,
    });
    expect(result.success).toBe(true);
  });
});
