import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { withValidation } from '../withValidation.js';
import { withErrorHandling } from '../withErrorHandling.js';
import { createMockApiEvent } from '../../test-utils/mockApiEvent.js';
import type { Context } from 'aws-lambda';

const mockContext = {} as Context;

const testSchema = z.object({
  name: z.string().min(1),
  age: z.number().int().positive(),
});

describe('withValidation', () => {
  it('rejects missing body with 400', async () => {
    const inner = vi.fn(async () => ({ statusCode: 200, body: '{}' }));
    const handler = withErrorHandling(withValidation(testSchema)(inner));
    const event = createMockApiEvent({ body: null });

    const result = await handler(event, mockContext);

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).error.code).toBe('VALIDATION_ERROR');
    expect(inner).not.toHaveBeenCalled();
  });

  it('rejects malformed JSON body with 400', async () => {
    const inner = vi.fn(async () => ({ statusCode: 200, body: '{}' }));
    const handler = withErrorHandling(withValidation(testSchema)(inner));
    const event = createMockApiEvent();
    event.body = 'not-json';

    const result = await handler(event, mockContext);

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).error.code).toBe('VALIDATION_ERROR');
    expect(inner).not.toHaveBeenCalled();
  });

  it('rejects invalid body with 400', async () => {
    const inner = vi.fn(async () => ({ statusCode: 200, body: '{}' }));
    const handler = withErrorHandling(withValidation(testSchema)(inner));
    const event = createMockApiEvent({ body: { name: '', age: -1 } });

    const result = await handler(event, mockContext);

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).error.code).toBe('VALIDATION_ERROR');
    expect(inner).not.toHaveBeenCalled();
  });

  it('passes valid body through to inner handler', async () => {
    const inner = vi.fn(async () => ({
      statusCode: 200,
      body: JSON.stringify({ data: 'ok' }),
    }));
    const handler = withErrorHandling(withValidation(testSchema)(inner));
    const event = createMockApiEvent({ body: { name: 'Alice', age: 30 } });

    const result = await handler(event, mockContext);

    expect(result.statusCode).toBe(200);
    expect(inner).toHaveBeenCalledOnce();
  });
});
