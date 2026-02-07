import type { APIGatewayProxyResult, Context } from 'aws-lambda';
import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { docClient } from '../../lib/dynamodb.js';
import { success } from '../../lib/response.js';
import { NotFoundError } from '../../lib/errors.js';
import { withErrorHandling } from '../../middleware/withErrorHandling.js';
import { withAdminAuth } from '../../middleware/withAdminAuth.js';
import type { AuthenticatedEvent } from '../../types.js';

async function deleteMenuItemHandler(
  event: AuthenticatedEvent,
  _context: Context,
): Promise<APIGatewayProxyResult> {
  const menuItemId = event.pathParameters?.id;
  const { tenantId } = event.auth;

  // Check existence
  const existing = await docClient.send(new GetCommand({
    TableName: process.env.MENU_ITEMS_TABLE_NAME!,
    Key: { tenantId, menuItemId },
  }));

  if (!existing.Item) {
    throw new NotFoundError('Menu item not found');
  }

  // Soft delete
  await docClient.send(new UpdateCommand({
    TableName: process.env.MENU_ITEMS_TABLE_NAME!,
    Key: { tenantId, menuItemId },
    UpdateExpression: 'SET isActive = :inactive, updatedAt = :now',
    ExpressionAttributeValues: {
      ':inactive': false,
      ':now': new Date().toISOString(),
    },
  }));

  return success({ message: 'Menu item deleted' });
}

export const handler = withErrorHandling(withAdminAuth(deleteMenuItemHandler));
