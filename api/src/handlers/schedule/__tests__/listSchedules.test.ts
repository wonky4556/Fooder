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

import { handler } from '../listSchedules.js';
import { createMockApiEvent } from '../../../test-utils/mockApiEvent.js';
import type { Context } from 'aws-lambda';

const mockContext = {} as Context;

describe('listSchedules handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.USERS_TABLE_NAME = 'test-users-table';
    process.env.SCHEDULES_TABLE_NAME = 'test-schedules-table';
  });

  it('admin: returns all schedules for tenant', async () => {
    mockDocSend.mockResolvedValueOnce({
      Item: { tenantId: 'DEFAULT', userId: 'admin-1', role: 'admin' },
    });
    mockDocSend.mockResolvedValueOnce({
      Items: [
        { scheduleId: 's-1', title: 'Monday Lunch', status: 'active' },
        { scheduleId: 's-2', title: 'Tuesday Lunch', status: 'draft' },
        { scheduleId: 's-3', title: 'Old Schedule', status: 'closed' },
      ],
    });

    const event = createMockApiEvent({
      method: 'GET',
      path: '/api/schedules',
      claims: { sub: 'admin-1' },
    });

    const result = await handler(event, mockContext);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.data).toHaveLength(3);
  });

  it('customer: returns only active schedules within time window', async () => {
    const now = new Date();
    const pastStart = new Date(now.getTime() - 3600000).toISOString(); // 1h ago
    const futureEnd = new Date(now.getTime() + 3600000).toISOString(); // 1h from now
    const pastEnd = new Date(now.getTime() - 1800000).toISOString(); // 30min ago

    mockDocSend.mockResolvedValueOnce({
      Item: { tenantId: 'DEFAULT', userId: 'customer-1', role: 'customer' },
    });
    mockDocSend.mockResolvedValueOnce({
      Items: [
        { scheduleId: 's-1', title: 'Current Schedule', status: 'active', startTime: pastStart, endTime: futureEnd },
        { scheduleId: 's-2', title: 'Expired Schedule', status: 'active', startTime: pastStart, endTime: pastEnd },
      ],
    });

    const event = createMockApiEvent({
      method: 'GET',
      path: '/api/schedules',
      claims: { sub: 'customer-1' },
    });

    const result = await handler(event, mockContext);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].title).toBe('Current Schedule');
  });

  it('returns empty array when no schedules exist', async () => {
    mockDocSend.mockResolvedValueOnce({
      Item: { tenantId: 'DEFAULT', userId: 'user-1', role: 'customer' },
    });
    mockDocSend.mockResolvedValueOnce({ Items: [] });

    const event = createMockApiEvent({
      method: 'GET',
      path: '/api/schedules',
      claims: { sub: 'user-1' },
    });

    const result = await handler(event, mockContext);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.data).toHaveLength(0);
  });
});
