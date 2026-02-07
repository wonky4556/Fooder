import type { APIGatewayProxyResult, Context } from 'aws-lambda';
import { GetCommand } from '@aws-sdk/lib-dynamodb';
import { docClient } from '../../lib/dynamodb.js';
import { success } from '../../lib/response.js';
import { NotFoundError } from '../../lib/errors.js';
import { withErrorHandling } from '../../middleware/withErrorHandling.js';
import { withAuth } from '../../middleware/withAuth.js';
import type { AuthenticatedEvent } from '../../types.js';

async function getMenuItemHandler(
  event: AuthenticatedEvent,
  _context: Context,
): Promise<APIGatewayProxyResult> {
  const menuItemId = event.pathParameters?.id;
  const { tenantId } = event.auth;

  const result = await docClient.send(new GetCommand({
    TableName: process.env.MENU_ITEMS_TABLE_NAME!,
    Key: { tenantId, menuItemId },
  }));

  if (!result.Item) {
    throw new NotFoundError('Menu item not found');
  }

  return success(result.Item);
}

export const handler = withErrorHandling(withAuth(getMenuItemHandler));
