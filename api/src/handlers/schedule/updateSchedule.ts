import type { APIGatewayProxyResult, Context } from 'aws-lambda';
import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { docClient } from '../../lib/dynamodb.js';
import { success } from '../../lib/response.js';
import { NotFoundError, ValidationError } from '../../lib/errors.js';
import { withErrorHandling } from '../../middleware/withErrorHandling.js';
import { withAdminAuth } from '../../middleware/withAdminAuth.js';
import { updateScheduleSchema } from '../../lib/validation/schedule.js';
import type { AuthenticatedEvent } from '../../types.js';

const VALID_TRANSITIONS: Record<string, string[]> = {
  draft: ['active'],
  active: ['closed'],
  closed: [],
};

async function updateScheduleHandler(
  event: AuthenticatedEvent,
  _context: Context,
): Promise<APIGatewayProxyResult> {
  const scheduleId = event.pathParameters?.id;
  const { tenantId } = event.auth;

  if (!event.body) throw new ValidationError('Request body is required');
  let parsed: unknown;
  try { parsed = JSON.parse(event.body); } catch { throw new ValidationError('Invalid JSON'); }

  const result = updateScheduleSchema.safeParse(parsed);
  if (!result.success) {
    throw new ValidationError(result.error.issues.map((i) => i.message).join(', '));
  }

  // Fetch existing schedule
  const existing = await docClient.send(new GetCommand({
    TableName: process.env.SCHEDULES_TABLE_NAME!,
    Key: { tenantId, scheduleId },
  }));

  if (!existing.Item) {
    throw new NotFoundError('Schedule not found');
  }

  const currentStatus = existing.Item.status as string;
  const input = result.data;

  // Validate status transition
  if (input.status && input.status !== currentStatus) {
    const allowed = VALID_TRANSITIONS[currentStatus] ?? [];
    if (!allowed.includes(input.status)) {
      throw new ValidationError(
        `Cannot transition from '${currentStatus}' to '${input.status}'`,
      );
    }
  }

  // Build dynamic update expression
  const updates: string[] = [];
  const names: Record<string, string> = {};
  const values: Record<string, unknown> = {};

  for (const [key, val] of Object.entries(input)) {
    if (val !== undefined) {
      const attrName = `#${key}`;
      const attrVal = `:${key}`;
      updates.push(`${attrName} = ${attrVal}`);
      names[attrName] = key;
      values[attrVal] = val;
    }
  }

  // Update statusStartTime if status or startTime changed
  const newStatus = input.status ?? currentStatus;
  const newStartTime = input.startTime ?? (existing.Item.startTime as string);
  if (input.status || input.startTime) {
    updates.push('#statusStartTime = :statusStartTime');
    names['#statusStartTime'] = 'statusStartTime';
    values[':statusStartTime'] = `${newStatus}#${newStartTime}`;
  }

  updates.push('#updatedAt = :updatedAt');
  names['#updatedAt'] = 'updatedAt';
  values[':updatedAt'] = new Date().toISOString();

  const updateResult = await docClient.send(new UpdateCommand({
    TableName: process.env.SCHEDULES_TABLE_NAME!,
    Key: { tenantId, scheduleId },
    UpdateExpression: `SET ${updates.join(', ')}`,
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values,
    ReturnValues: 'ALL_NEW',
  }));

  return success(updateResult.Attributes);
}

export const handler = withErrorHandling(withAdminAuth(updateScheduleHandler));
