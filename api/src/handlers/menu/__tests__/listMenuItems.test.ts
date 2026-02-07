import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockDocSend = vi.hoisted(() => vi.fn());

vi.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: vi.fn(() => ({ send: mockDocSend })),
  },
  GetCommand: vi.fn((input) => ({ input, _type: 'GetCommand' })),
  QueryCommand: vi.fn((input) => ({ input, _type: 'QueryCommand' })),
}));

vi.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: vi.fn(() => ({})),
}));

import { handler } from '../listMenuItems.js';
import { createMockApiEvent } from '../../../test-utils/mockApiEvent.js';
import type { Context } from 'aws-lambda';

const mockContext = {} as Context;

describe('listMenuItems handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.USERS_TABLE_NAME = 'test-users-table';
    process.env.MENU_ITEMS_TABLE_NAME = 'test-menu-items-table';
  });

  it('returns active menu items for authenticated user', async () => {
    mockDocSend.mockResolvedValueOnce({
      Item: { tenantId: 'DEFAULT', userId: 'user-1', role: 'customer' },
    });
    mockDocSend.mockResolvedValueOnce({
      Items: [
        { menuItemId: 'item-1', name: 'Pizza', price: 12, isActive: true },
        { menuItemId: 'item-2', name: 'Pasta', price: 10, isActive: true },
      ],
    });

    const event = createMockApiEvent({
      method: 'GET',
      path: '/api/menu-items',
      claims: { sub: 'user-1' },
    });

    const result = await handler(event, mockContext);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.data).toHaveLength(2);
    expect(body.data[0].name).toBe('Pizza');
  });

  it('returns all items including inactive for admin with includeInactive=true', async () => {
    mockDocSend.mockResolvedValueOnce({
      Item: { tenantId: 'DEFAULT', userId: 'admin-1', role: 'admin' },
    });
    mockDocSend.mockResolvedValueOnce({
      Items: [
        { menuItemId: 'item-1', name: 'Pizza', price: 12, isActive: true },
        { menuItemId: 'item-2', name: 'Old Item', price: 10, isActive: false },
      ],
    });

    const event = createMockApiEvent({
      method: 'GET',
      path: '/api/menu-items',
      claims: { sub: 'admin-1' },
      queryStringParameters: { includeInactive: 'true' },
    });

    const result = await handler(event, mockContext);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.data).toHaveLength(2);
  });

  it('returns empty array when no items exist', async () => {
    mockDocSend.mockResolvedValueOnce({
      Item: { tenantId: 'DEFAULT', userId: 'user-1', role: 'customer' },
    });
    mockDocSend.mockResolvedValueOnce({ Items: [] });

    const event = createMockApiEvent({
      method: 'GET',
      path: '/api/menu-items',
      claims: { sub: 'user-1' },
    });

    const result = await handler(event, mockContext);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.data).toHaveLength(0);
  });
});
