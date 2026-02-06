import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import type { ZodSchema } from 'zod';
import { ValidationError } from '../lib/errors.js';

type Handler = (
  event: APIGatewayProxyEvent,
  context: Context,
) => Promise<APIGatewayProxyResult>;

export function withValidation(schema: ZodSchema) {
  return (handler: Handler): Handler => {
    return async (event, context) => {
      if (!event.body) {
        throw new ValidationError('Request body is required');
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(event.body);
      } catch {
        throw new ValidationError('Invalid JSON in request body');
      }

      const result = schema.safeParse(parsed);
      if (!result.success) {
        throw new ValidationError(result.error.issues.map((i) => i.message).join(', '));
      }

      return handler(event, context);
    };
  };
}
