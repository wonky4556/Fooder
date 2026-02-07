import type { APIGatewayProxyResult, Context } from 'aws-lambda';
import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { docClient } from '../../lib/dynamodb.js';
import { success } from '../../lib/response.js';
import { withErrorHandling } from '../../middleware/withErrorHandling.js';
import { withAuth } from '../../middleware/withAuth.js';
import type { AuthenticatedEvent } from '../../types.js';

async function listMenuItemsHandler(
  event: AuthenticatedEvent,
  _context: Context,
): Promise<APIGatewayProxyResult> {
  const { tenantId, role } = event.auth;
  const includeInactive = role === 'admin'
    && event.queryStringParameters?.includeInactive === 'true';

  const expressionValues: Record<string, unknown> = { ':tid': tenantId };
  let filterExpression: string | undefined;

  if (!includeInactive) {
    filterExpression = 'isActive = :active';
    expressionValues[':active'] = true;
  }

  const result = await docClient.send(new QueryCommand({
    TableName: process.env.MENU_ITEMS_TABLE_NAME!,
    KeyConditionExpression: 'tenantId = :tid',
    ExpressionAttributeValues: expressionValues,
    ...(filterExpression && { FilterExpression: filterExpression }),
  }));

  return success(result.Items ?? []);
}

export const handler = withErrorHandling(withAuth(listMenuItemsHandler));
