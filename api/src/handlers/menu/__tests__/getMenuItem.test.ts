import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockDocSend = vi.hoisted(() => vi.fn());

vi.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: vi.fn(() => ({ send: mockDocSend })),
  },
  GetCommand: vi.fn((input) => ({ input, _type: 'GetCommand' })),
}));

vi.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: vi.fn(() => ({})),
}));

import { handler } from '../getMenuItem.js';
import { createMockApiEvent } from '../../../test-utils/mockApiEvent.js';
import type { Context } from 'aws-lambda';

const mockContext = {} as Context;

describe('getMenuItem handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.USERS_TABLE_NAME = 'test-users-table';
    process.env.MENU_ITEMS_TABLE_NAME = 'test-menu-items-table';
  });

  it('returns item by tenantId and menuItemId', async () => {
    mockDocSend.mockResolvedValueOnce({
      Item: { tenantId: 'DEFAULT', userId: 'user-1', role: 'customer' },
    });
    mockDocSend.mockResolvedValueOnce({
      Item: {
        tenantId: 'DEFAULT',
        menuItemId: 'item-1',
        name: 'Pizza',
        price: 12.99,
        category: 'main',
        isActive: true,
      },
    });

    const event = createMockApiEvent({
      method: 'GET',
      path: '/api/menu-items/item-1',
      claims: { sub: 'user-1' },
      pathParameters: { id: 'item-1' },
    });

    const result = await handler(event, mockContext);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.data.menuItemId).toBe('item-1');
    expect(body.data.name).toBe('Pizza');
  });

  it('returns 404 for non-existent item', async () => {
    mockDocSend.mockResolvedValueOnce({
      Item: { tenantId: 'DEFAULT', userId: 'user-1', role: 'customer' },
    });
    mockDocSend.mockResolvedValueOnce({ Item: undefined });

    const event = createMockApiEvent({
      method: 'GET',
      path: '/api/menu-items/nonexistent',
      claims: { sub: 'user-1' },
      pathParameters: { id: 'nonexistent' },
    });

    const result = await handler(event, mockContext);

    expect(result.statusCode).toBe(404);
    expect(JSON.parse(result.body).error.code).toBe('NOT_FOUND');
  });
});
