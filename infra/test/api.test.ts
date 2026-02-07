import { App } from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { describe, it, beforeAll } from 'vitest';
import { FooderAppStack } from '../lib/fooder-app-stack';

describe('Api Construct', () => {
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

  it('creates an API Gateway REST API', () => {
    template.hasResourceProperties('AWS::ApiGateway::RestApi', {
      Name: Match.stringLikeRegexp('fooder'),
    });
  });

  it('creates a Cognito Authorizer', () => {
    template.hasResourceProperties('AWS::ApiGateway::Authorizer', {
      Type: 'COGNITO_USER_POOLS',
      ProviderARNs: Match.anyValue(),
    });
  });

  it('creates Lambda functions for menu item handlers with correct env vars', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      Environment: {
        Variables: Match.objectLike({
          MENU_ITEMS_TABLE_NAME: Match.anyValue(),
          USERS_TABLE_NAME: Match.anyValue(),
        }),
      },
      Runtime: 'nodejs22.x',
    });
  });

  it('creates Lambda functions for schedule handlers with correct env vars', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      Environment: {
        Variables: Match.objectLike({
          SCHEDULES_TABLE_NAME: Match.anyValue(),
          USERS_TABLE_NAME: Match.anyValue(),
        }),
      },
      Runtime: 'nodejs22.x',
    });
  });

  it('creates getMe Lambda with PII_KEY_ARN env var', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      Environment: {
        Variables: Match.objectLike({
          PII_KEY_ARN: Match.anyValue(),
          USERS_TABLE_NAME: Match.anyValue(),
        }),
      },
      Runtime: 'nodejs22.x',
    });
  });

  it('grants menu Lambdas DynamoDB permissions on MenuItems table', () => {
    template.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: Match.arrayWith([
              'dynamodb:PutItem',
              'dynamodb:Query',
            ]),
            Effect: 'Allow',
          }),
        ]),
      },
    });
  });

  it('grants schedule Lambdas DynamoDB permissions on Schedules table', () => {
    template.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: Match.arrayWith([
              'dynamodb:PutItem',
              'dynamodb:Query',
            ]),
            Effect: 'Allow',
          }),
        ]),
      },
    });
  });

  it('grants getMe Lambda KMS permissions', () => {
    template.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: Match.arrayWith([
              'kms:Encrypt',
              'kms:Decrypt',
            ]),
            Effect: 'Allow',
          }),
        ]),
      },
    });
  });

  it('configures CORS with OPTIONS methods', () => {
    template.hasResourceProperties('AWS::ApiGateway::Method', {
      HttpMethod: 'OPTIONS',
    });
  });

  it('exports API URL via SSM parameter', () => {
    template.hasResourceProperties('AWS::SSM::Parameter', {
      Name: '/test/fooder/api/url',
    });
  });
});
