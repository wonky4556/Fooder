import type { APIGatewayProxyEvent } from 'aws-lambda';
import type { UserRole } from '@fooder/shared-types';

export interface AuthContext {
  userId: string;
  tenantId: string;
  role: UserRole;
}

export interface AuthenticatedEvent extends APIGatewayProxyEvent {
  auth: AuthContext;
}
