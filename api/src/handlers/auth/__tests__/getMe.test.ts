import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockDocSend = vi.hoisted(() => vi.fn());
const mockKmsSend = vi.hoisted(() => vi.fn());

vi.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: vi.fn(() => ({ send: mockDocSend })),
  },
  GetCommand: vi.fn((input) => ({ input, _type: 'GetCommand' })),
}));

vi.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: vi.fn(() => ({})),
}));

vi.mock('@aws-sdk/client-kms', () => ({
  KMSClient: vi.fn(() => ({ send: mockKmsSend })),
  DecryptCommand: vi.fn((input) => ({ input, _type: 'DecryptCommand' })),
  EncryptCommand: vi.fn((input) => ({ input, _type: 'EncryptCommand' })),
}));

import { handler } from '../getMe.js';
import { createMockApiEvent } from '../../../test-utils/mockApiEvent.js';
import type { Context } from 'aws-lambda';

const mockContext = {} as Context;

describe('getMe handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.USERS_TABLE_NAME = 'test-users-table';
    process.env.PII_KEY_ARN = 'arn:aws:kms:us-east-1:123456789012:key/test-key';
  });

  it('returns decrypted UserProfile for authenticated user', async () => {
    // withAuth DynamoDB lookup
    mockDocSend.mockResolvedValueOnce({
      Item: {
        tenantId: 'DEFAULT',
        userId: 'user-123',
        role: 'admin',
        emailHash: 'abc123',
        encryptedEmail: 'ZW5jcnlwdGVk',
        encryptedDisplayName: 'ZW5jcnlwdGVk',
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
      },
    });

    // getMe DynamoDB lookup for full user record
    mockDocSend.mockResolvedValueOnce({
      Item: {
        tenantId: 'DEFAULT',
        userId: 'user-123',
        role: 'admin',
        emailHash: 'abc123',
        encryptedEmail: 'ZW5jcnlwdGVk',
        encryptedDisplayName: 'ZW5jcnlwdGVk',
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
      },
    });

    // Decrypt email
    mockKmsSend.mockResolvedValueOnce({
      Plaintext: new TextEncoder().encode('user@example.com'),
    });
    // Decrypt display name
    mockKmsSend.mockResolvedValueOnce({
      Plaintext: new TextEncoder().encode('Test User'),
    });

    const event = createMockApiEvent({
      method: 'GET',
      path: '/api/me',
      claims: { sub: 'user-123' },
    });

    const result = await handler(event, mockContext);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.data.userId).toBe('user-123');
    expect(body.data.email).toBe('user@example.com');
    expect(body.data.displayName).toBe('Test User');
    expect(body.data.role).toBe('admin');
    expect(body.data.tenantId).toBe('DEFAULT');
  });

  it('returns 401 for unauthenticated request', async () => {
    const event = createMockApiEvent({
      method: 'GET',
      path: '/api/me',
      claims: null,
    });

    const result = await handler(event, mockContext);

    expect(result.statusCode).toBe(401);
    expect(JSON.parse(result.body).error.code).toBe('UNAUTHORIZED');
  });
});
