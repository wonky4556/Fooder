import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockDocSend = vi.hoisted(() => vi.fn());

vi.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: vi.fn(() => ({ send: mockDocSend })),
  },
  GetCommand: vi.fn((input) => ({ input, _type: 'GetCommand' })),
  PutCommand: vi.fn((input) => ({ input, _type: 'PutCommand' })),
  BatchGetCommand: vi.fn((input) => ({ input, _type: 'BatchGetCommand' })),
}));

vi.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: vi.fn(() => ({})),
}));

import { handler } from '../createSchedule.js';
import { createMockApiEvent } from '../../../test-utils/mockApiEvent.js';
import type { Context } from 'aws-lambda';

const mockContext = {} as Context;

describe('createSchedule handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.USERS_TABLE_NAME = 'test-users-table';
    process.env.MENU_ITEMS_TABLE_NAME = 'test-menu-items-table';
    process.env.SCHEDULES_TABLE_NAME = 'test-schedules-table';
  });

  const validBody = {
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

  it('creates schedule with embedded item snapshots and returns 201', async () => {
    // withAuth user lookup
    mockDocSend.mockResolvedValueOnce({
      Item: { tenantId: 'DEFAULT', userId: 'admin-1', role: 'admin' },
    });
    // BatchGetCommand for menu items
    mockDocSend.mockResolvedValueOnce({
      Responses: {
        'test-menu-items-table': [
          { tenantId: 'DEFAULT', menuItemId: 'item-1', name: 'Pizza', price: 12.99, isActive: true },
          { tenantId: 'DEFAULT', menuItemId: 'item-2', name: 'Pasta', price: 9.99, isActive: true },
        ],
      },
    });
    // PutCommand
    mockDocSend.mockResolvedValueOnce({});

    const event = createMockApiEvent({
      method: 'POST',
      path: '/api/schedules',
      claims: { sub: 'admin-1' },
      body: validBody,
    });

    const result = await handler(event, mockContext);

    expect(result.statusCode).toBe(201);
    const body = JSON.parse(result.body);
    expect(body.data.title).toBe('Friday Lunch');
    expect(body.data.status).toBe('draft');
    expect(body.data.scheduleId).toBeDefined();
    expect(body.data.items).toHaveLength(2);
    expect(body.data.items[0].name).toBe('Pizza');
    expect(body.data.items[0].price).toBe(12.99);
    expect(body.data.items[0].totalQuantity).toBe(10);
    expect(body.data.items[0].remainingQuantity).toBe(10);
    expect(body.data.items[1].name).toBe('Pasta');
    expect(body.data.items[1].remainingQuantity).toBe(5);
  });

  it('returns 400 when referenced menu item does not exist', async () => {
    mockDocSend.mockResolvedValueOnce({
      Item: { tenantId: 'DEFAULT', userId: 'admin-1', role: 'admin' },
    });
    // BatchGetCommand returns only one of two items
    mockDocSend.mockResolvedValueOnce({
      Responses: {
        'test-menu-items-table': [
          { tenantId: 'DEFAULT', menuItemId: 'item-1', name: 'Pizza', price: 12.99, isActive: true },
        ],
      },
    });

    const event = createMockApiEvent({
      method: 'POST',
      path: '/api/schedules',
      claims: { sub: 'admin-1' },
      body: validBody,
    });

    const result = await handler(event, mockContext);
    expect(result.statusCode).toBe(400);
  });

  it('returns 400 when referenced menu item is inactive', async () => {
    mockDocSend.mockResolvedValueOnce({
      Item: { tenantId: 'DEFAULT', userId: 'admin-1', role: 'admin' },
    });
    mockDocSend.mockResolvedValueOnce({
      Responses: {
        'test-menu-items-table': [
          { tenantId: 'DEFAULT', menuItemId: 'item-1', name: 'Pizza', price: 12.99, isActive: true },
          { tenantId: 'DEFAULT', menuItemId: 'item-2', name: 'Old Pasta', price: 9.99, isActive: false },
        ],
      },
    });

    const event = createMockApiEvent({
      method: 'POST',
      path: '/api/schedules',
      claims: { sub: 'admin-1' },
      body: validBody,
    });

    const result = await handler(event, mockContext);
    expect(result.statusCode).toBe(400);
  });

  it('returns 400 for invalid input (endTime before startTime)', async () => {
    mockDocSend.mockResolvedValueOnce({
      Item: { tenantId: 'DEFAULT', userId: 'admin-1', role: 'admin' },
    });

    const event = createMockApiEvent({
      method: 'POST',
      path: '/api/schedules',
      claims: { sub: 'admin-1' },
      body: {
        ...validBody,
        startTime: '2025-06-01T14:00:00.000Z',
        endTime: '2025-06-01T10:00:00.000Z',
      },
    });

    const result = await handler(event, mockContext);
    expect(result.statusCode).toBe(400);
  });

  it('returns 403 for non-admin user', async () => {
    mockDocSend.mockResolvedValueOnce({
      Item: { tenantId: 'DEFAULT', userId: 'customer-1', role: 'customer' },
    });

    const event = createMockApiEvent({
      method: 'POST',
      path: '/api/schedules',
      claims: { sub: 'customer-1' },
      body: validBody,
    });

    const result = await handler(event, mockContext);
    expect(result.statusCode).toBe(403);
  });
});
