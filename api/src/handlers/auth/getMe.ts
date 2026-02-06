import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { GetCommand } from '@aws-sdk/lib-dynamodb';
import { docClient } from '../../lib/dynamodb.js';
import { decryptPII } from '../../lib/crypto.js';
import { withErrorHandling } from '../../middleware/withErrorHandling.js';
import { withAuth } from '../../middleware/withAuth.js';
import { success } from '../../lib/response.js';
import { NotFoundError } from '../../lib/errors.js';
import type { AuthenticatedEvent } from '../../types.js';
import type { UserProfile } from '@fooder/shared-types';

async function getMeHandler(
  event: AuthenticatedEvent,
  _context: Context,
): Promise<APIGatewayProxyResult> {
  const { userId, tenantId } = event.auth;

  const result = await docClient.send(
    new GetCommand({
      TableName: process.env.USERS_TABLE_NAME!,
      Key: { tenantId, userId },
    }),
  );

  if (!result.Item) {
    throw new NotFoundError('User not found');
  }

  const [email, displayName] = await Promise.all([
    decryptPII(result.Item.encryptedEmail as string),
    decryptPII(result.Item.encryptedDisplayName as string),
  ]);

  const profile: UserProfile = {
    userId,
    email,
    displayName,
    role: result.Item.role as UserProfile['role'],
    tenantId,
  };

  return success(profile);
}

export const handler = withErrorHandling(withAuth(getMeHandler));
