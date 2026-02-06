import { describe, it, expect } from 'vitest';
import { success, error } from '../response.js';
import { NotFoundError, ValidationError } from '../errors.js';

describe('response', () => {
  describe('success', () => {
    it('returns correct status code, JSON body, and CORS headers', () => {
      const data = { id: '123', name: 'Test' };
      const result = success(data);

      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body)).toEqual({ data });
      expect(result.headers).toMatchObject({
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      });
    });

    it('supports custom status code', () => {
      const result = success({ created: true }, 201);
      expect(result.statusCode).toBe(201);
    });
  });

  describe('error', () => {
    it('maps AppError to HTTP response with correct format', () => {
      const err = new NotFoundError('User not found');
      const result = error(err);

      expect(result.statusCode).toBe(404);
      expect(JSON.parse(result.body)).toEqual({
        error: {
          code: 'NOT_FOUND',
          message: 'User not found',
        },
      });
      expect(result.headers).toMatchObject({
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      });
    });

    it('maps ValidationError to 400 response', () => {
      const err = new ValidationError('Invalid email');
      const result = error(err);

      expect(result.statusCode).toBe(400);
      expect(JSON.parse(result.body)).toEqual({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid email',
        },
      });
    });
  });
});
