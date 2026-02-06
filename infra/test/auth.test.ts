import { App } from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { describe, it, beforeAll } from 'vitest';
import { FooderAppStack } from '../lib/fooder-app-stack';

describe('Auth Construct', () => {
  let template: Template;

  beforeAll(() => {
    const app = new App({ context: { stage: 'test' } });
    const stack = new FooderAppStack(app, 'TestAppStack', {
      stage: 'test',
      googleClientId: 'test-google-client-id',
      googleClientSecret: 'test-google-client-secret',
      adminEmailHashes: 'testhash1,testhash2',
      callbackUrls: ['http://localhost:5173/auth/callback'],
      logoutUrls: ['http://localhost:5173/login'],
    });
    template = Template.fromStack(stack);
  });

  it('creates a Cognito User Pool with email auto-verification', () => {
    template.hasResourceProperties('AWS::Cognito::UserPool', {
      AutoVerifiedAttributes: ['email'],
    });
  });

  it('configures Google identity provider', () => {
    template.hasResourceProperties('AWS::Cognito::UserPoolIdentityProvider', {
      ProviderName: 'Google',
      ProviderType: 'Google',
      ProviderDetails: Match.objectLike({
        client_id: 'test-google-client-id',
        client_secret: 'test-google-client-secret',
        authorize_scopes: 'openid email profile',
      }),
    });
  });

  it('creates a User Pool Client with OAuth scopes and authorization code flow', () => {
    template.hasResourceProperties('AWS::Cognito::UserPoolClient', {
      AllowedOAuthFlows: ['code'],
      AllowedOAuthScopes: ['openid', 'email', 'profile'],
      AllowedOAuthFlowsUserPoolClient: true,
      SupportedIdentityProviders: Match.arrayWith(['Google']),
      CallbackURLs: ['http://localhost:5173/auth/callback'],
      LogoutURLs: ['http://localhost:5173/login'],
    });
  });

  it('attaches post-confirmation Lambda trigger to User Pool', () => {
    template.hasResourceProperties('AWS::Cognito::UserPool', {
      LambdaConfig: {
        PostConfirmation: Match.anyValue(),
      },
    });
  });

  it('creates a post-confirmation Lambda function with correct env vars', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      Environment: {
        Variables: Match.objectLike({
          USERS_TABLE_NAME: Match.anyValue(),
          PII_KEY_ARN: Match.anyValue(),
          ADMIN_EMAIL_HASHES: 'testhash1,testhash2',
        }),
      },
      Runtime: 'nodejs22.x',
    });
  });

  it('grants Lambda DynamoDB PutItem permissions', () => {
    template.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: Match.arrayWith([
              'dynamodb:PutItem',
            ]),
            Effect: 'Allow',
          }),
        ]),
      },
    });
  });

  it('grants Lambda KMS Encrypt/Decrypt permissions', () => {
    template.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: Match.arrayWith([
              'kms:Encrypt',
            ]),
            Effect: 'Allow',
          }),
        ]),
      },
    });
  });

  it('exports SSM parameters for user pool ID and client ID', () => {
    template.hasResourceProperties('AWS::SSM::Parameter', {
      Name: '/test/fooder/auth/user-pool-id',
    });
    template.hasResourceProperties('AWS::SSM::Parameter', {
      Name: '/test/fooder/auth/user-pool-client-id',
    });
  });
});
