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

import { handler } from '../getSchedule.js';
import { createMockApiEvent } from '../../../test-utils/mockApiEvent.js';
import type { Context } from 'aws-lambda';

const mockContext = {} as Context;

describe('getSchedule handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.USERS_TABLE_NAME = 'test-users-table';
    process.env.SCHEDULES_TABLE_NAME = 'test-schedules-table';
  });

  it('returns schedule with all embedded items', async () => {
    mockDocSend.mockResolvedValueOnce({
      Item: { tenantId: 'DEFAULT', userId: 'user-1', role: 'customer' },
    });
    mockDocSend.mockResolvedValueOnce({
      Item: {
        tenantId: 'DEFAULT',
        scheduleId: 's-1',
        title: 'Friday Lunch',
        status: 'active',
        items: [
          { menuItemId: 'item-1', name: 'Pizza', price: 12.99, totalQuantity: 10, remainingQuantity: 8 },
        ],
      },
    });

    const event = createMockApiEvent({
      method: 'GET',
      path: '/api/schedules/s-1',
      claims: { sub: 'user-1' },
      pathParameters: { id: 's-1' },
    });

    const result = await handler(event, mockContext);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.data.scheduleId).toBe('s-1');
    expect(body.data.items).toHaveLength(1);
    expect(body.data.items[0].remainingQuantity).toBe(8);
  });

  it('returns 404 for non-existent schedule', async () => {
    mockDocSend.mockResolvedValueOnce({
      Item: { tenantId: 'DEFAULT', userId: 'user-1', role: 'customer' },
    });
    mockDocSend.mockResolvedValueOnce({ Item: undefined });

    const event = createMockApiEvent({
      method: 'GET',
      path: '/api/schedules/nonexistent',
      claims: { sub: 'user-1' },
      pathParameters: { id: 'nonexistent' },
    });

    const result = await handler(event, mockContext);
    expect(result.statusCode).toBe(404);
  });
});
