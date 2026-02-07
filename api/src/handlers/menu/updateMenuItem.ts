import type { APIGatewayProxyResult, Context } from 'aws-lambda';
import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { docClient } from '../../lib/dynamodb.js';
import { success } from '../../lib/response.js';
import { NotFoundError, ValidationError } from '../../lib/errors.js';
import { withErrorHandling } from '../../middleware/withErrorHandling.js';
import { withAdminAuth } from '../../middleware/withAdminAuth.js';
import { updateMenuItemSchema } from '../../lib/validation/menu.js';
import type { AuthenticatedEvent } from '../../types.js';

async function updateMenuItemHandler(
  event: AuthenticatedEvent,
  _context: Context,
): Promise<APIGatewayProxyResult> {
  const menuItemId = event.pathParameters?.id;
  const { tenantId } = event.auth;

  if (!event.body) throw new ValidationError('Request body is required');
  let parsed: unknown;
  try { parsed = JSON.parse(event.body); } catch { throw new ValidationError('Invalid JSON'); }

  const result = updateMenuItemSchema.safeParse(parsed);
  if (!result.success) {
    throw new ValidationError(result.error.issues.map((i) => i.message).join(', '));
  }

  // Check existence
  const existing = await docClient.send(new GetCommand({
    TableName: process.env.MENU_ITEMS_TABLE_NAME!,
    Key: { tenantId, menuItemId },
  }));

  if (!existing.Item) {
    throw new NotFoundError('Menu item not found');
  }

  // Build dynamic update expression
  const updates: string[] = [];
  const names: Record<string, string> = {};
  const values: Record<string, unknown> = {};

  for (const [key, val] of Object.entries(result.data)) {
    if (val !== undefined) {
      const attrName = `#${key}`;
      const attrVal = `:${key}`;
      updates.push(`${attrName} = ${attrVal}`);
      names[attrName] = key;
      values[attrVal] = val;
    }
  }

  updates.push('#updatedAt = :updatedAt');
  names['#updatedAt'] = 'updatedAt';
  values[':updatedAt'] = new Date().toISOString();

  const updateResult = await docClient.send(new UpdateCommand({
    TableName: process.env.MENU_ITEMS_TABLE_NAME!,
    Key: { tenantId, menuItemId },
    UpdateExpression: `SET ${updates.join(', ')}`,
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values,
    ReturnValues: 'ALL_NEW',
  }));

  return success(updateResult.Attributes);
}

export const handler = withErrorHandling(withAdminAuth(updateMenuItemHandler));
