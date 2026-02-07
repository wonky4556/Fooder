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

import { handler } from '../updateSchedule.js';
import { createMockApiEvent } from '../../../test-utils/mockApiEvent.js';
import type { Context } from 'aws-lambda';

const mockContext = {} as Context;

describe('updateSchedule handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.USERS_TABLE_NAME = 'test-users-table';
    process.env.SCHEDULES_TABLE_NAME = 'test-schedules-table';
  });

  it('updates schedule fields and returns 200', async () => {
    mockDocSend.mockResolvedValueOnce({
      Item: { tenantId: 'DEFAULT', userId: 'admin-1', role: 'admin' },
    });
    mockDocSend.mockResolvedValueOnce({
      Item: { tenantId: 'DEFAULT', scheduleId: 's-1', title: 'Old Title', status: 'draft', startTime: '2025-06-01T10:00:00.000Z' },
    });
    mockDocSend.mockResolvedValueOnce({
      Attributes: { tenantId: 'DEFAULT', scheduleId: 's-1', title: 'New Title', status: 'draft' },
    });

    const event = createMockApiEvent({
      method: 'PUT',
      path: '/api/schedules/s-1',
      claims: { sub: 'admin-1' },
      pathParameters: { id: 's-1' },
      body: { title: 'New Title' },
    });

    const result = await handler(event, mockContext);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.data.title).toBe('New Title');
  });

  it('transitions status from draft to active', async () => {
    mockDocSend.mockResolvedValueOnce({
      Item: { tenantId: 'DEFAULT', userId: 'admin-1', role: 'admin' },
    });
    mockDocSend.mockResolvedValueOnce({
      Item: { tenantId: 'DEFAULT', scheduleId: 's-1', status: 'draft', startTime: '2025-06-01T10:00:00.000Z' },
    });
    mockDocSend.mockResolvedValueOnce({
      Attributes: { tenantId: 'DEFAULT', scheduleId: 's-1', status: 'active' },
    });

    const event = createMockApiEvent({
      method: 'PUT',
      path: '/api/schedules/s-1',
      claims: { sub: 'admin-1' },
      pathParameters: { id: 's-1' },
      body: { status: 'active' },
    });

    const result = await handler(event, mockContext);
    expect(result.statusCode).toBe(200);
  });

  it('transitions status from active to closed', async () => {
    mockDocSend.mockResolvedValueOnce({
      Item: { tenantId: 'DEFAULT', userId: 'admin-1', role: 'admin' },
    });
    mockDocSend.mockResolvedValueOnce({
      Item: { tenantId: 'DEFAULT', scheduleId: 's-1', status: 'active', startTime: '2025-06-01T10:00:00.000Z' },
    });
    mockDocSend.mockResolvedValueOnce({
      Attributes: { tenantId: 'DEFAULT', scheduleId: 's-1', status: 'closed' },
    });

    const event = createMockApiEvent({
      method: 'PUT',
      path: '/api/schedules/s-1',
      claims: { sub: 'admin-1' },
      pathParameters: { id: 's-1' },
      body: { status: 'closed' },
    });

    const result = await handler(event, mockContext);
    expect(result.statusCode).toBe(200);
  });

  it('returns 400 for invalid status transition (closed to active)', async () => {
    mockDocSend.mockResolvedValueOnce({
      Item: { tenantId: 'DEFAULT', userId: 'admin-1', role: 'admin' },
    });
    mockDocSend.mockResolvedValueOnce({
      Item: { tenantId: 'DEFAULT', scheduleId: 's-1', status: 'closed', startTime: '2025-06-01T10:00:00.000Z' },
    });

    const event = createMockApiEvent({
      method: 'PUT',
      path: '/api/schedules/s-1',
      claims: { sub: 'admin-1' },
      pathParameters: { id: 's-1' },
      body: { status: 'active' },
    });

    const result = await handler(event, mockContext);
    expect(result.statusCode).toBe(400);
  });

  it('returns 400 for backward transition (active to draft)', async () => {
    mockDocSend.mockResolvedValueOnce({
      Item: { tenantId: 'DEFAULT', userId: 'admin-1', role: 'admin' },
    });
    mockDocSend.mockResolvedValueOnce({
      Item: { tenantId: 'DEFAULT', scheduleId: 's-1', status: 'active', startTime: '2025-06-01T10:00:00.000Z' },
    });

    const event = createMockApiEvent({
      method: 'PUT',
      path: '/api/schedules/s-1',
      claims: { sub: 'admin-1' },
      pathParameters: { id: 's-1' },
      body: { status: 'draft' },
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
      method: 'PUT',
      path: '/api/schedules/nonexistent',
      claims: { sub: 'admin-1' },
      pathParameters: { id: 'nonexistent' },
      body: { title: 'Updated' },
    });

    const result = await handler(event, mockContext);
    expect(result.statusCode).toBe(404);
  });

  it('returns 403 for non-admin user', async () => {
    mockDocSend.mockResolvedValueOnce({
      Item: { tenantId: 'DEFAULT', userId: 'customer-1', role: 'customer' },
    });

    const event = createMockApiEvent({
      method: 'PUT',
      path: '/api/schedules/s-1',
      claims: { sub: 'customer-1' },
      pathParameters: { id: 's-1' },
      body: { title: 'Updated' },
    });

    const result = await handler(event, mockContext);
    expect(result.statusCode).toBe(403);
  });
});
