import { describe, it, expect } from 'vitest';
import { createScheduleSchema, updateScheduleSchema } from '../schedule.js';

describe('createScheduleSchema', () => {
  const validInput = {
    title: 'Friday Lunch',
    description: 'Weekly lunch order',
    pickupInstructions: 'Pick up at front desk',
    startTime: '2025-06-01T10:00:00.000Z',
    endTime: '2025-06-01T14:00:00.000Z',
    items: [
      { menuItemId: 'item-1', totalQuantity: 10 },
      { menuItemId: 'item-2', totalQuantity: 5 },
    ],
  };

  it('accepts valid input', () => {
    const result = createScheduleSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it('rejects missing title', () => {
    const { title, ...rest } = validInput;
    const result = createScheduleSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('rejects endTime before startTime', () => {
    const result = createScheduleSchema.safeParse({
      ...validInput,
      startTime: '2025-06-01T14:00:00.000Z',
      endTime: '2025-06-01T10:00:00.000Z',
    });
    expect(result.success).toBe(false);
  });

  it('rejects endTime equal to startTime', () => {
    const result = createScheduleSchema.safeParse({
      ...validInput,
      startTime: '2025-06-01T10:00:00.000Z',
      endTime: '2025-06-01T10:00:00.000Z',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty items array', () => {
    const result = createScheduleSchema.safeParse({
      ...validInput,
      items: [],
    });
    expect(result.success).toBe(false);
  });

  it('rejects items with zero quantity', () => {
    const result = createScheduleSchema.safeParse({
      ...validInput,
      items: [{ menuItemId: 'item-1', totalQuantity: 0 }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects items with negative quantity', () => {
    const result = createScheduleSchema.safeParse({
      ...validInput,
      items: [{ menuItemId: 'item-1', totalQuantity: -5 }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects non-integer quantity', () => {
    const result = createScheduleSchema.safeParse({
      ...validInput,
      items: [{ menuItemId: 'item-1', totalQuantity: 2.5 }],
    });
    expect(result.success).toBe(false);
  });
});

describe('updateScheduleSchema', () => {
  it('accepts partial updates', () => {
    const result = updateScheduleSchema.safeParse({
      title: 'Updated Title',
    });
    expect(result.success).toBe(true);
  });

  it('accepts valid status values', () => {
    for (const status of ['draft', 'active', 'closed']) {
      const result = updateScheduleSchema.safeParse({ status });
      expect(result.success).toBe(true);
    }
  });

  it('rejects invalid status values', () => {
    const result = updateScheduleSchema.safeParse({
      status: 'cancelled',
    });
    expect(result.success).toBe(false);
  });

  it('accepts empty object', () => {
    const result = updateScheduleSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});
