import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { GetCommand } from '@aws-sdk/lib-dynamodb';
import { docClient } from '../lib/dynamodb.js';
import { UnauthorizedError } from '../lib/errors.js';
import type { AuthenticatedEvent } from '../types.js';

type AuthenticatedHandler = (
  event: AuthenticatedEvent,
  context: Context,
) => Promise<APIGatewayProxyResult>;

type Handler = (
  event: APIGatewayProxyEvent,
  context: Context,
) => Promise<APIGatewayProxyResult>;

export function withAuth(handler: AuthenticatedHandler): Handler {
  return async (event, context) => {
    const claims = event.requestContext.authorizer?.claims;
    if (!claims?.sub) {
      throw new UnauthorizedError('Missing authentication');
    }

    const userId = claims.sub as string;

    const result = await docClient.send(
      new GetCommand({
        TableName: process.env.USERS_TABLE_NAME!,
        Key: {
          tenantId: 'DEFAULT',
          userId,
        },
      }),
    );

    if (!result.Item) {
      throw new UnauthorizedError('User not found');
    }

    const authenticatedEvent = event as AuthenticatedEvent;
    authenticatedEvent.auth = {
      userId,
      tenantId: result.Item.tenantId as string,
      role: result.Item.role as 'admin' | 'customer',
    };

    return handler(authenticatedEvent, context);
  };
}
