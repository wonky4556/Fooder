import { describe, it, expect } from 'vitest';
import { withErrorHandling } from '../withErrorHandling.js';
import { NotFoundError, AppError } from '../../lib/errors.js';
import { createMockApiEvent } from '../../test-utils/mockApiEvent.js';
import type { APIGatewayProxyEvent, Context } from 'aws-lambda';

const mockContext = {} as Context;

describe('withErrorHandling', () => {
  it('passes through successful responses unchanged', async () => {
    const handler = async () => ({
      statusCode: 200,
      body: JSON.stringify({ data: 'ok' }),
    });

    const wrapped = withErrorHandling(handler);
    const event = createMockApiEvent();
    const result = await wrapped(event, mockContext);

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toEqual({ data: 'ok' });
  });

  it('catches AppError and maps to correct HTTP response', async () => {
    const handler = async () => {
      throw new NotFoundError('User not found');
    };

    const wrapped = withErrorHandling(handler);
    const event = createMockApiEvent();
    const result = await wrapped(event, mockContext);

    expect(result.statusCode).toBe(404);
    expect(JSON.parse(result.body)).toEqual({
      error: { code: 'NOT_FOUND', message: 'User not found' },
    });
  });

  it('catches unknown errors and returns 500', async () => {
    const handler = async () => {
      throw new Error('Something unexpected');
    };

    const wrapped = withErrorHandling(handler);
    const event = createMockApiEvent();
    const result = await wrapped(event, mockContext);

    expect(result.statusCode).toBe(500);
    expect(JSON.parse(result.body)).toEqual({
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    });
  });
});
