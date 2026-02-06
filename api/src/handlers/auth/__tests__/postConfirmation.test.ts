import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockDocSend = vi.hoisted(() => vi.fn());
const mockKmsSend = vi.hoisted(() => vi.fn());

vi.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: vi.fn(() => ({ send: mockDocSend })),
  },
  PutCommand: vi.fn((input) => ({ input, _type: 'PutCommand' })),
  UpdateCommand: vi.fn((input) => ({ input, _type: 'UpdateCommand' })),
}));

vi.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: vi.fn(() => ({})),
}));

vi.mock('@aws-sdk/client-kms', () => ({
  KMSClient: vi.fn(() => ({ send: mockKmsSend })),
  EncryptCommand: vi.fn((input) => ({ input, _type: 'EncryptCommand' })),
}));

import { handler } from '../postConfirmation.js';
import { createMockCognitoEvent } from '../../../test-utils/mockCognitoEvent.js';
import { hashEmail } from '../../../lib/crypto.js';
import type { Context } from 'aws-lambda';

const mockContext = {} as Context;

describe('postConfirmation handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.USERS_TABLE_NAME = 'test-users-table';
    process.env.PII_KEY_ARN = 'arn:aws:kms:us-east-1:123456789012:key/test-key';
    process.env.ADMIN_EMAIL_HASHES = '';
  });

  it('creates user in DynamoDB with hashed email and encrypted PII', async () => {
    mockKmsSend.mockResolvedValue({
      CiphertextBlob: new Uint8Array([1, 2, 3]),
    });
    mockDocSend.mockResolvedValueOnce({});

    const event = createMockCognitoEvent({
      sub: 'user-abc',
      email: 'test@example.com',
      name: 'Test User',
    });

    const result = await handler(event, mockContext);

    expect(result).toBe(event);
    expect(mockDocSend).toHaveBeenCalledOnce();

    const putInput = mockDocSend.mock.calls[0][0].input;
    expect(putInput.TableName).toBe('test-users-table');
    expect(putInput.Item.tenantId).toBe('DEFAULT');
    expect(putInput.Item.userId).toBe('user-abc');
    expect(putInput.Item.emailHash).toBe(hashEmail('test@example.com'));
    expect(putInput.Item.encryptedEmail).toBeDefined();
    expect(putInput.Item.encryptedDisplayName).toBeDefined();
    expect(putInput.Item.role).toBe('customer');
    expect(putInput.ConditionExpression).toBe('attribute_not_exists(userId)');
  });

  it('assigns admin role when emailHash matches ADMIN_EMAIL_HASHES', async () => {
    const adminEmailHash = hashEmail('admin@example.com');
    process.env.ADMIN_EMAIL_HASHES = adminEmailHash;

    mockKmsSend.mockResolvedValue({
      CiphertextBlob: new Uint8Array([4, 5, 6]),
    });
    mockDocSend.mockResolvedValueOnce({});

    const event = createMockCognitoEvent({
      sub: 'admin-user',
      email: 'admin@example.com',
      name: 'Admin User',
    });

    await handler(event, mockContext);

    const putInput = mockDocSend.mock.calls[0][0].input;
    expect(putInput.Item.role).toBe('admin');
  });

  it('assigns customer role for non-admin emails', async () => {
    process.env.ADMIN_EMAIL_HASHES = 'some-other-hash';

    mockKmsSend.mockResolvedValue({
      CiphertextBlob: new Uint8Array([7, 8, 9]),
    });
    mockDocSend.mockResolvedValueOnce({});

    const event = createMockCognitoEvent({
      sub: 'regular-user',
      email: 'regular@example.com',
      name: 'Regular User',
    });

    await handler(event, mockContext);

    const putInput = mockDocSend.mock.calls[0][0].input;
    expect(putInput.Item.role).toBe('customer');
  });

  it('updates existing user on ConditionalCheckFailedException', async () => {
    const adminEmailHash = hashEmail('existing@example.com');
    process.env.ADMIN_EMAIL_HASHES = adminEmailHash;

    mockKmsSend.mockResolvedValue({
      CiphertextBlob: new Uint8Array([10, 11, 12]),
    });
    mockDocSend
      .mockRejectedValueOnce({ name: 'ConditionalCheckFailedException' })
      .mockResolvedValueOnce({}); // UpdateCommand succeeds

    const event = createMockCognitoEvent({
      sub: 'existing-user',
      email: 'existing@example.com',
      name: 'Existing User',
    });

    const result = await handler(event, mockContext);
    expect(result).toBe(event);

    // First call is PutCommand (fails), second is UpdateCommand
    expect(mockDocSend).toHaveBeenCalledTimes(2);
    const updateInput = mockDocSend.mock.calls[1][0].input;
    expect(updateInput.TableName).toBe('test-users-table');
    expect(updateInput.Key).toEqual({ tenantId: 'DEFAULT', userId: 'existing-user' });
    expect(updateInput.ExpressionAttributeValues[':role']).toBe('admin');
    expect(updateInput.ExpressionAttributeValues[':ee']).toBeDefined();
    expect(updateInput.ExpressionAttributeValues[':edn']).toBeDefined();
    expect(updateInput.ExpressionAttributeValues[':eh']).toBe(adminEmailHash);
  });

  it('sets tenantId to DEFAULT', async () => {
    mockKmsSend.mockResolvedValue({
      CiphertextBlob: new Uint8Array([13, 14, 15]),
    });
    mockDocSend.mockResolvedValueOnce({});

    const event = createMockCognitoEvent({
      sub: 'tenant-test-user',
      email: 'tenant@example.com',
      name: 'Tenant User',
    });

    await handler(event, mockContext);

    const putInput = mockDocSend.mock.calls[0][0].input;
    expect(putInput.Item.tenantId).toBe('DEFAULT');
  });
});
