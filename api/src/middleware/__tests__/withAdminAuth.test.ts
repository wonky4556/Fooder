import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSend = vi.hoisted(() => vi.fn());

vi.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: vi.fn(() => ({ send: mockSend })),
  },
  GetCommand: vi.fn((input) => ({ input })),
}));

vi.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: vi.fn(() => ({})),
}));

import { withAdminAuth } from '../withAdminAuth.js';
import { withErrorHandling } from '../withErrorHandling.js';
import { createMockApiEvent } from '../../test-utils/mockApiEvent.js';
import type { Context } from 'aws-lambda';

const mockContext = {} as Context;

describe('withAdminAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.USERS_TABLE_NAME = 'test-users-table';
  });

  it('allows admin role through', async () => {
    mockSend.mockResolvedValueOnce({
      Item: {
        tenantId: 'DEFAULT',
        userId: 'admin-user',
        role: 'admin',
      },
    });

    const inner = vi.fn(async () => ({
      statusCode: 200,
      body: JSON.stringify({ data: 'admin-content' }),
    }));

    const handler = withErrorHandling(withAdminAuth(inner));
    const event = createMockApiEvent({
      claims: { sub: 'admin-user' },
    });

    const result = await handler(event, mockContext);

    expect(result.statusCode).toBe(200);
    expect(inner).toHaveBeenCalledOnce();
  });

  it('rejects customer role with 403', async () => {
    mockSend.mockResolvedValueOnce({
      Item: {
        tenantId: 'DEFAULT',
        userId: 'customer-user',
        role: 'customer',
      },
    });

    const inner = vi.fn(async () => ({ statusCode: 200, body: '{}' }));
    const handler = withErrorHandling(withAdminAuth(inner));
    const event = createMockApiEvent({
      claims: { sub: 'customer-user' },
    });

    const result = await handler(event, mockContext);

    expect(result.statusCode).toBe(403);
    expect(JSON.parse(result.body).error.code).toBe('FORBIDDEN');
    expect(inner).not.toHaveBeenCalled();
  });
});
