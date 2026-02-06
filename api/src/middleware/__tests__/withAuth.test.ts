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

import { withAuth } from '../withAuth.js';
import { withErrorHandling } from '../withErrorHandling.js';
import { createMockApiEvent } from '../../test-utils/mockApiEvent.js';
import type { Context } from 'aws-lambda';
import type { AuthenticatedEvent } from '../../types.js';

const mockContext = {} as Context;

describe('withAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.USERS_TABLE_NAME = 'test-users-table';
  });

  it('extracts userId from Cognito JWT claims.sub', async () => {
    mockSend.mockResolvedValueOnce({
      Item: {
        tenantId: 'DEFAULT',
        userId: 'user-123',
        role: 'customer',
      },
    });

    let capturedEvent: AuthenticatedEvent | null = null;
    const inner = vi.fn(async (event: AuthenticatedEvent) => {
      capturedEvent = event;
      return { statusCode: 200, body: '{}' };
    });

    const handler = withErrorHandling(withAuth(inner));
    const event = createMockApiEvent({
      claims: { sub: 'user-123', email: 'user@example.com' },
    });

    await handler(event, mockContext);

    expect(capturedEvent!.auth.userId).toBe('user-123');
    expect(capturedEvent!.auth.tenantId).toBe('DEFAULT');
    expect(capturedEvent!.auth.role).toBe('customer');
  });

  it('rejects missing claims with 401', async () => {
    const inner = vi.fn(async () => ({ statusCode: 200, body: '{}' }));
    const handler = withErrorHandling(withAuth(inner));
    const event = createMockApiEvent({ claims: null });

    const result = await handler(event, mockContext);

    expect(result.statusCode).toBe(401);
    expect(JSON.parse(result.body).error.code).toBe('UNAUTHORIZED');
    expect(inner).not.toHaveBeenCalled();
  });

  it('returns 401 if user not found in DynamoDB', async () => {
    mockSend.mockResolvedValueOnce({ Item: undefined });

    const inner = vi.fn(async () => ({ statusCode: 200, body: '{}' }));
    const handler = withErrorHandling(withAuth(inner));
    const event = createMockApiEvent({
      claims: { sub: 'nonexistent-user' },
    });

    const result = await handler(event, mockContext);

    expect(result.statusCode).toBe(401);
    expect(inner).not.toHaveBeenCalled();
  });
});
