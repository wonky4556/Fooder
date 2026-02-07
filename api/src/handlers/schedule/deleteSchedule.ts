import type { APIGatewayProxyResult, Context } from 'aws-lambda';
import { GetCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { docClient } from '../../lib/dynamodb.js';
import { success } from '../../lib/response.js';
import { NotFoundError, ValidationError } from '../../lib/errors.js';
import { withErrorHandling } from '../../middleware/withErrorHandling.js';
import { withAdminAuth } from '../../middleware/withAdminAuth.js';
import type { AuthenticatedEvent } from '../../types.js';

async function deleteScheduleHandler(
  event: AuthenticatedEvent,
  _context: Context,
): Promise<APIGatewayProxyResult> {
  const scheduleId = event.pathParameters?.id;
  const { tenantId } = event.auth;

  // Fetch existing schedule
  const existing = await docClient.send(new GetCommand({
    TableName: process.env.SCHEDULES_TABLE_NAME!,
    Key: { tenantId, scheduleId },
  }));

  if (!existing.Item) {
    throw new NotFoundError('Schedule not found');
  }

  if (existing.Item.status !== 'draft') {
    throw new ValidationError('Only draft schedules can be deleted');
  }

  await docClient.send(new DeleteCommand({
    TableName: process.env.SCHEDULES_TABLE_NAME!,
    Key: { tenantId, scheduleId },
  }));

  return success({ message: 'Schedule deleted' });
}

export const handler = withErrorHandling(withAdminAuth(deleteScheduleHandler));
