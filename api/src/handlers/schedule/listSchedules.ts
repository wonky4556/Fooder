import type { APIGatewayProxyResult, Context } from 'aws-lambda';
import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { docClient } from '../../lib/dynamodb.js';
import { success } from '../../lib/response.js';
import { withErrorHandling } from '../../middleware/withErrorHandling.js';
import { withAuth } from '../../middleware/withAuth.js';
import type { AuthenticatedEvent } from '../../types.js';

async function listSchedulesHandler(
  event: AuthenticatedEvent,
  _context: Context,
): Promise<APIGatewayProxyResult> {
  const { tenantId, role } = event.auth;

  if (role === 'admin') {
    // Admin: return all schedules
    const result = await docClient.send(new QueryCommand({
      TableName: process.env.SCHEDULES_TABLE_NAME!,
      KeyConditionExpression: 'tenantId = :tid',
      ExpressionAttributeValues: { ':tid': tenantId },
    }));
    return success(result.Items ?? []);
  }

  // Customer: return active schedules within time window
  const result = await docClient.send(new QueryCommand({
    TableName: process.env.SCHEDULES_TABLE_NAME!,
    IndexName: 'schedule-status-index',
    KeyConditionExpression: 'tenantId = :tid AND begins_with(statusStartTime, :prefix)',
    ExpressionAttributeValues: {
      ':tid': tenantId,
      ':prefix': 'active#',
    },
  }));

  const now = new Date();
  const filtered = (result.Items ?? []).filter((schedule) => {
    const start = new Date(schedule.startTime as string);
    const end = new Date(schedule.endTime as string);
    return start <= now && now <= end;
  });

  return success(filtered);
}

export const handler = withErrorHandling(withAuth(listSchedulesHandler));
