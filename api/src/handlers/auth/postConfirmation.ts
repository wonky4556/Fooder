import type { PostConfirmationConfirmSignUpTriggerEvent, Context } from 'aws-lambda';
import { PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { docClient } from '../../lib/dynamodb.js';
import { hashEmail, encryptPII } from '../../lib/crypto.js';

function getRole(emailHash: string): 'admin' | 'customer' {
  const adminEmailHashes = (process.env.ADMIN_EMAIL_HASHES || '')
    .split(',')
    .map((h) => h.trim())
    .filter(Boolean);

  return adminEmailHashes.includes(emailHash) ? 'admin' : 'customer';
}

export async function handler(
  event: PostConfirmationConfirmSignUpTriggerEvent,
  _context: Context,
): Promise<PostConfirmationConfirmSignUpTriggerEvent> {
  const { sub, email, name } = event.request.userAttributes;

  const emailHash = hashEmail(email);
  const [encryptedEmail, encryptedDisplayName] = await Promise.all([
    encryptPII(email),
    encryptPII(name || ''),
  ]);

  const role = getRole(emailHash);
  const now = new Date().toISOString();

  try {
    await docClient.send(
      new PutCommand({
        TableName: process.env.USERS_TABLE_NAME!,
        Item: {
          tenantId: 'DEFAULT',
          userId: sub,
          emailHash,
          encryptedEmail,
          encryptedDisplayName,
          role,
          createdAt: now,
          updatedAt: now,
        },
        ConditionExpression: 'attribute_not_exists(userId)',
      }),
    );
  } catch (err: unknown) {
    if ((err as { name?: string }).name === 'ConditionalCheckFailedException') {
      // User already exists — update role and encrypted PII in case they changed
      await docClient.send(
        new UpdateCommand({
          TableName: process.env.USERS_TABLE_NAME!,
          Key: { tenantId: 'DEFAULT', userId: sub },
          UpdateExpression:
            'SET #role = :role, encryptedEmail = :ee, encryptedDisplayName = :edn, emailHash = :eh, updatedAt = :now',
          ExpressionAttributeNames: { '#role': 'role' },
          ExpressionAttributeValues: {
            ':role': role,
            ':ee': encryptedEmail,
            ':edn': encryptedDisplayName,
            ':eh': emailHash,
            ':now': now,
          },
        }),
      );
      return event;
    }
    throw err;
  }

  return event;
}
