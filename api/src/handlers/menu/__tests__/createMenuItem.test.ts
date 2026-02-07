import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockDocSend = vi.hoisted(() => vi.fn());

vi.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: vi.fn(() => ({ send: mockDocSend })),
  },
  GetCommand: vi.fn((input) => ({ input, _type: 'GetCommand' })),
  PutCommand: vi.fn((input) => ({ input, _type: 'PutCommand' })),
}));

vi.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: vi.fn(() => ({})),
}));

import { handler } from '../createMenuItem.js';
import { createMockApiEvent } from '../../../test-utils/mockApiEvent.js';
import type { Context } from 'aws-lambda';

const mockContext = {} as Context;

describe('createMenuItem handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.USERS_TABLE_NAME = 'test-users-table';
    process.env.MENU_ITEMS_TABLE_NAME = 'test-menu-items-table';
  });

  it('creates item in DynamoDB and returns 201', async () => {
    // withAuth user lookup
    mockDocSend.mockResolvedValueOnce({
      Item: { tenantId: 'DEFAULT', userId: 'admin-user', role: 'admin' },
    });
    // PutCommand
    mockDocSend.mockResolvedValueOnce({});

    const event = createMockApiEvent({
      method: 'POST',
      path: '/api/menu-items',
      claims: { sub: 'admin-user' },
      body: {
        name: 'Margherita Pizza',
        description: 'Classic pizza',
        price: 12.99,
        category: 'main',
      },
    });

    const result = await handler(event, mockContext);

    expect(result.statusCode).toBe(201);
    const body = JSON.parse(result.body);
    expect(body.data.name).toBe('Margherita Pizza');
    expect(body.data.price).toBe(12.99);
    expect(body.data.category).toBe('main');
    expect(body.data.isActive).toBe(true);
    expect(body.data.menuItemId).toBeDefined();
    expect(body.data.tenantId).toBe('DEFAULT');
    expect(body.data.createdAt).toBeDefined();
    expect(body.data.updatedAt).toBeDefined();
  });

  it('returns 400 for invalid input (missing name)', async () => {
    mockDocSend.mockResolvedValueOnce({
      Item: { tenantId: 'DEFAULT', userId: 'admin-user', role: 'admin' },
    });

    const event = createMockApiEvent({
      method: 'POST',
      path: '/api/menu-items',
      claims: { sub: 'admin-user' },
      body: { price: 10, category: 'main' },
    });

    const result = await handler(event, mockContext);
    expect(result.statusCode).toBe(400);
  });

  it('returns 400 for negative price', async () => {
    mockDocSend.mockResolvedValueOnce({
      Item: { tenantId: 'DEFAULT', userId: 'admin-user', role: 'admin' },
    });

    const event = createMockApiEvent({
      method: 'POST',
      path: '/api/menu-items',
      claims: { sub: 'admin-user' },
      body: { name: 'Test', price: -5, category: 'main' },
    });

    const result = await handler(event, mockContext);
    expect(result.statusCode).toBe(400);
  });

  it('returns 403 for non-admin user', async () => {
    mockDocSend.mockResolvedValueOnce({
      Item: { tenantId: 'DEFAULT', userId: 'customer-user', role: 'customer' },
    });

    const event = createMockApiEvent({
      method: 'POST',
      path: '/api/menu-items',
      claims: { sub: 'customer-user' },
      body: { name: 'Test', price: 10, category: 'main' },
    });

    const result = await handler(event, mockContext);
    expect(result.statusCode).toBe(403);
  });

  it('returns 401 for unauthenticated request', async () => {
    const event = createMockApiEvent({
      method: 'POST',
      path: '/api/menu-items',
      claims: null,
      body: { name: 'Test', price: 10, category: 'main' },
    });

    const result = await handler(event, mockContext);
    expect(result.statusCode).toBe(401);
  });
});
