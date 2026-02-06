import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSend = vi.hoisted(() => vi.fn());

vi.mock('@aws-sdk/client-kms', () => ({
  KMSClient: vi.fn(() => ({ send: mockSend })),
  EncryptCommand: vi.fn((input) => ({ input, _type: 'EncryptCommand' })),
  DecryptCommand: vi.fn((input) => ({ input, _type: 'DecryptCommand' })),
}));

import { hashEmail, encryptPII, decryptPII } from '../crypto.js';

describe('crypto', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('hashEmail', () => {
    it('produces consistent SHA-256 hex for the same input', () => {
      const hash1 = hashEmail('user@example.com');
      const hash2 = hashEmail('user@example.com');
      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[a-f0-9]{64}$/);
    });

    it('is case-insensitive', () => {
      const hash1 = hashEmail('User@Example.COM');
      const hash2 = hashEmail('user@example.com');
      expect(hash1).toBe(hash2);
    });

    it('trims whitespace', () => {
      const hash1 = hashEmail('  user@example.com  ');
      const hash2 = hashEmail('user@example.com');
      expect(hash1).toBe(hash2);
    });
  });

  describe('encryptPII', () => {
    it('calls KMS encrypt and returns base64 string', async () => {
      const ciphertextBlob = new Uint8Array([1, 2, 3, 4]);
      mockSend.mockResolvedValueOnce({ CiphertextBlob: ciphertextBlob });

      const result = await encryptPII('sensitive-data');
      expect(result).toBe(Buffer.from(ciphertextBlob).toString('base64'));
      expect(mockSend).toHaveBeenCalledOnce();
    });
  });

  describe('decryptPII', () => {
    it('calls KMS decrypt and returns original plaintext', async () => {
      const plaintext = new TextEncoder().encode('sensitive-data');
      mockSend.mockResolvedValueOnce({ Plaintext: plaintext });

      const result = await decryptPII('AQIDBA==');
      expect(result).toBe('sensitive-data');
      expect(mockSend).toHaveBeenCalledOnce();
    });
  });

  describe('roundtrip', () => {
    it('encryptPII then decryptPII preserves original value', async () => {
      const original = 'user@example.com';
      const ciphertextBlob = new Uint8Array([10, 20, 30]);
      const plaintextBytes = new TextEncoder().encode(original);

      mockSend
        .mockResolvedValueOnce({ CiphertextBlob: ciphertextBlob })
        .mockResolvedValueOnce({ Plaintext: plaintextBytes });

      const encrypted = await encryptPII(original);
      const decrypted = await decryptPII(encrypted);
      expect(decrypted).toBe(original);
    });
  });
});
