import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockDocSend = vi.hoisted(() => vi.fn());

vi.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: vi.fn(() => ({ send: mockDocSend })),
  },
  GetCommand: vi.fn((input) => ({ input, _type: 'GetCommand' })),
  UpdateCommand: vi.fn((input) => ({ input, _type: 'UpdateCommand' })),
}));

vi.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: vi.fn(() => ({})),
}));

import { handler } from '../deleteMenuItem.js';
import { createMockApiEvent } from '../../../test-utils/mockApiEvent.js';
import type { Context } from 'aws-lambda';

const mockContext = {} as Context;

describe('deleteMenuItem handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.USERS_TABLE_NAME = 'test-users-table';
    process.env.MENU_ITEMS_TABLE_NAME = 'test-menu-items-table';
  });

  it('soft-deletes item by setting isActive=false', async () => {
    mockDocSend.mockResolvedValueOnce({
      Item: { tenantId: 'DEFAULT', userId: 'admin-1', role: 'admin' },
    });
    mockDocSend.mockResolvedValueOnce({
      Item: { tenantId: 'DEFAULT', menuItemId: 'item-1', name: 'Pizza', isActive: true },
    });
    mockDocSend.mockResolvedValueOnce({});

    const event = createMockApiEvent({
      method: 'DELETE',
      path: '/api/menu-items/item-1',
      claims: { sub: 'admin-1' },
      pathParameters: { id: 'item-1' },
    });

    const result = await handler(event, mockContext);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.data.message).toBe('Menu item deleted');
  });

  it('returns 404 for non-existent item', async () => {
    mockDocSend.mockResolvedValueOnce({
      Item: { tenantId: 'DEFAULT', userId: 'admin-1', role: 'admin' },
    });
    mockDocSend.mockResolvedValueOnce({ Item: undefined });

    const event = createMockApiEvent({
      method: 'DELETE',
      path: '/api/menu-items/nonexistent',
      claims: { sub: 'admin-1' },
      pathParameters: { id: 'nonexistent' },
    });

    const result = await handler(event, mockContext);
    expect(result.statusCode).toBe(404);
  });

  it('returns 403 for non-admin user', async () => {
    mockDocSend.mockResolvedValueOnce({
      Item: { tenantId: 'DEFAULT', userId: 'customer-1', role: 'customer' },
    });

    const event = createMockApiEvent({
      method: 'DELETE',
      path: '/api/menu-items/item-1',
      claims: { sub: 'customer-1' },
      pathParameters: { id: 'item-1' },
    });

    const result = await handler(event, mockContext);
    expect(result.statusCode).toBe(403);
  });
});
