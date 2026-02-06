import { createHash } from 'node:crypto';
import { KMSClient, EncryptCommand, DecryptCommand } from '@aws-sdk/client-kms';

const kmsClient = new KMSClient({});
const PII_KEY_ARN = process.env.PII_KEY_ARN!;

export function hashEmail(email: string): string {
  const normalized = email.toLowerCase().trim();
  return createHash('sha256').update(normalized).digest('hex');
}

export async function encryptPII(plaintext: string): Promise<string> {
  const command = new EncryptCommand({
    KeyId: PII_KEY_ARN,
    Plaintext: new TextEncoder().encode(plaintext),
  });

  const response = await kmsClient.send(command);
  return Buffer.from(response.CiphertextBlob!).toString('base64');
}

export async function decryptPII(ciphertext: string): Promise<string> {
  const command = new DecryptCommand({
    CiphertextBlob: Buffer.from(ciphertext, 'base64'),
  });

  const response = await kmsClient.send(command);
  return new TextDecoder().decode(response.Plaintext!);
}
