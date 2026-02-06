import type { PostConfirmationConfirmSignUpTriggerEvent } from 'aws-lambda';

interface MockCognitoEventOptions {
  sub?: string;
  email?: string;
  name?: string;
}

export function createMockCognitoEvent(
  options: MockCognitoEventOptions = {},
): PostConfirmationConfirmSignUpTriggerEvent {
  const {
    sub = 'test-user-id-123',
    email = 'user@example.com',
    name = 'Test User',
  } = options;

  return {
    version: '1',
    triggerSource: 'PostConfirmation_ConfirmSignUp',
    region: 'us-east-1',
    userPoolId: 'us-east-1_TestPool',
    userName: sub,
    callerContext: {
      awsSdkVersion: '3.0.0',
      clientId: 'test-client-id',
    },
    request: {
      userAttributes: {
        sub,
        email,
        email_verified: 'true',
        name,
      },
    },
    response: {},
  };
}
