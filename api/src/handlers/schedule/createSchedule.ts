import type { APIGatewayProxyResult, Context } from 'aws-lambda';
import { BatchGetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { ulid } from 'ulid';
import { docClient } from '../../lib/dynamodb.js';
import { success } from '../../lib/response.js';
import { ValidationError } from '../../lib/errors.js';
import { withErrorHandling } from '../../middleware/withErrorHandling.js';
import { withAdminAuth } from '../../middleware/withAdminAuth.js';
import { createScheduleSchema } from '../../lib/validation/schedule.js';
import type { AuthenticatedEvent } from '../../types.js';

async function createScheduleHandler(
  event: AuthenticatedEvent,
  _context: Context,
): Promise<APIGatewayProxyResult> {
  if (!event.body) throw new ValidationError('Request body is required');
  let parsed: unknown;
  try { parsed = JSON.parse(event.body); } catch { throw new ValidationError('Invalid JSON'); }

  const result = createScheduleSchema.safeParse(parsed);
  if (!result.success) {
    throw new ValidationError(result.error.issues.map((i) => i.message).join(', '));
  }

  const input = result.data;
  const { tenantId } = event.auth;
  const menuItemsTableName = process.env.MENU_ITEMS_TABLE_NAME!;

  // Fetch all referenced menu items to validate and snapshot
  const batchResult = await docClient.send(new BatchGetCommand({
    RequestItems: {
      [menuItemsTableName]: {
        Keys: input.items.map((item) => ({
          tenantId,
          menuItemId: item.menuItemId,
        })),
      },
    },
  }));

  const fetchedItems = batchResult.Responses?.[menuItemsTableName] ?? [];
  const fetchedMap = new Map(
    fetchedItems.map((item) => [item.menuItemId as string, item]),
  );

  // Validate all items exist and are active
  for (const item of input.items) {
    const menuItem = fetchedMap.get(item.menuItemId);
    if (!menuItem) {
      throw new ValidationError(`Menu item not found: ${item.menuItemId}`);
    }
    if (!menuItem.isActive) {
      throw new ValidationError(`Menu item is inactive: ${item.menuItemId}`);
    }
  }

  // Build schedule with embedded item snapshots
  const now = new Date().toISOString();
  const scheduleId = ulid();
  const scheduleItems = input.items.map((item) => {
    const menuItem = fetchedMap.get(item.menuItemId)!;
    return {
      menuItemId: item.menuItemId,
      name: menuItem.name as string,
      price: menuItem.price as number,
      totalQuantity: item.totalQuantity,
      remainingQuantity: item.totalQuantity,
    };
  });

  const schedule = {
    tenantId,
    scheduleId,
    title: input.title,
    description: input.description,
    pickupInstructions: input.pickupInstructions,
    startTime: input.startTime,
    endTime: input.endTime,
    status: 'draft' as const,
    statusStartTime: `draft#${input.startTime}`,
    items: scheduleItems,
    createdAt: now,
    updatedAt: now,
  };

  await docClient.send(new PutCommand({
    TableName: process.env.SCHEDULES_TABLE_NAME!,
    Item: schedule,
  }));

  return success(schedule, 201);
}

export const handler = withErrorHandling(withAdminAuth(createScheduleHandler));
