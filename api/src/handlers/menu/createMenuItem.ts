import type { APIGatewayProxyResult, Context } from 'aws-lambda';
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { ulid } from 'ulid';
import { docClient } from '../../lib/dynamodb.js';
import { success } from '../../lib/response.js';
import { ValidationError } from '../../lib/errors.js';
import { withErrorHandling } from '../../middleware/withErrorHandling.js';
import { withAdminAuth } from '../../middleware/withAdminAuth.js';
import { createMenuItemSchema } from '../../lib/validation/menu.js';
import type { AuthenticatedEvent } from '../../types.js';

async function createMenuItemHandler(
  event: AuthenticatedEvent,
  _context: Context,
): Promise<APIGatewayProxyResult> {
  if (!event.body) throw new ValidationError('Request body is required');
  let parsed: unknown;
  try { parsed = JSON.parse(event.body); } catch { throw new ValidationError('Invalid JSON'); }

  const result = createMenuItemSchema.safeParse(parsed);
  if (!result.success) {
    throw new ValidationError(result.error.issues.map((i) => i.message).join(', '));
  }

  const input = result.data;
  const now = new Date().toISOString();
  const item = {
    tenantId: event.auth.tenantId,
    menuItemId: ulid(),
    name: input.name,
    description: input.description,
    price: input.price,
    imageUrl: input.imageUrl,
    category: input.category,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };

  await docClient.send(new PutCommand({
    TableName: process.env.MENU_ITEMS_TABLE_NAME!,
    Item: item,
  }));

  return success(item, 201);
}

export const handler = withErrorHandling(withAdminAuth(createMenuItemHandler));
