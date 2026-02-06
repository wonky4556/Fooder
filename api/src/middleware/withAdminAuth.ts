import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { withAuth } from './withAuth.js';
import { ForbiddenError } from '../lib/errors.js';
import type { AuthenticatedEvent } from '../types.js';

type AuthenticatedHandler = (
  event: AuthenticatedEvent,
  context: Context,
) => Promise<APIGatewayProxyResult>;

type Handler = (
  event: APIGatewayProxyEvent,
  context: Context,
) => Promise<APIGatewayProxyResult>;

export function withAdminAuth(handler: AuthenticatedHandler): Handler {
  return withAuth(async (event, context) => {
    if (event.auth.role !== 'admin') {
      throw new ForbiddenError('Admin access required');
    }

    return handler(event, context);
  });
}
