import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockDocSend = vi.hoisted(() => vi.fn());

vi.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: vi.fn(() => ({ send: mockDocSend })),
  },
  GetCommand: vi.fn((input) => ({ input, _type: 'GetCommand' })),
  DeleteCommand: vi.fn((input) => ({ input, _type: 'DeleteCommand' })),
}));

vi.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: vi.fn(() => ({})),
}));

import { handler } from '../deleteSchedule.js';
import { createMockApiEvent } from '../../../test-utils/mockApiEvent.js';
import type { Context } from 'aws-lambda';

const mockContext = {} as Context;

describe('deleteSchedule handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.USERS_TABLE_NAME = 'test-users-table';
    process.env.SCHEDULES_TABLE_NAME = 'test-schedules-table';
  });

  it('deletes draft schedule and returns 200', async () => {
    mockDocSend.mockResolvedValueOnce({
      Item: { tenantId: 'DEFAULT', userId: 'admin-1', role: 'admin' },
    });
    mockDocSend.mockResolvedValueOnce({
      Item: { tenantId: 'DEFAULT', scheduleId: 's-1', title: 'Draft Schedule', status: 'draft' },
    });
    mockDocSend.mockResolvedValueOnce({});

    const event = createMockApiEvent({
      method: 'DELETE',
      path: '/api/schedules/s-1',
      claims: { sub: 'admin-1' },
      pathParameters: { id: 's-1' },
    });

    const result = await handler(event, mockContext);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.data.message).toBe('Schedule deleted');
  });

  it('returns 400 for active schedule', async () => {
    mockDocSend.mockResolvedValueOnce({
      Item: { tenantId: 'DEFAULT', userId: 'admin-1', role: 'admin' },
    });
    mockDocSend.mockResolvedValueOnce({
      Item: { tenantId: 'DEFAULT', scheduleId: 's-1', status: 'active' },
    });

    const event = createMockApiEvent({
      method: 'DELETE',
      path: '/api/schedules/s-1',
      claims: { sub: 'admin-1' },
      pathParameters: { id: 's-1' },
    });

    const result = await handler(event, mockContext);
    expect(result.statusCode).toBe(400);
  });

  it('returns 400 for closed schedule', async () => {
    mockDocSend.mockResolvedValueOnce({
      Item: { tenantId: 'DEFAULT', userId: 'admin-1', role: 'admin' },
    });
    mockDocSend.mockResolvedValueOnce({
      Item: { tenantId: 'DEFAULT', scheduleId: 's-1', status: 'closed' },
    });

    const event = createMockApiEvent({
      method: 'DELETE',
      path: '/api/schedules/s-1',
      claims: { sub: 'admin-1' },
      pathParameters: { id: 's-1' },
    });

    const result = await handler(event, mockContext);
    expect(result.statusCode).toBe(400);
  });

  it('returns 404 for non-existent schedule', async () => {
    mockDocSend.mockResolvedValueOnce({
      Item: { tenantId: 'DEFAULT', userId: 'admin-1', role: 'admin' },
    });
    mockDocSend.mockResolvedValueOnce({ Item: undefined });

    const event = createMockApiEvent({
      method: 'DELETE',
      path: '/api/schedules/nonexistent',
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
      path: '/api/schedules/s-1',
      claims: { sub: 'customer-1' },
      pathParameters: { id: 's-1' },
    });

    const result = await handler(event, mockContext);
    expect(result.statusCode).toBe(403);
  });
});
