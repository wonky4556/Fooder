export type UserRole = 'admin' | 'customer';

export interface User {
  tenantId: string;
  userId: string;
  emailHash: string;
  encryptedEmail: string;
  encryptedDisplayName: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

export interface UserProfile {
  userId: string;
  email: string;
  displayName: string;
  role: UserRole;
  tenantId: string;
}
