import { App } from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { describe, it, beforeAll } from 'vitest';
import { FooderAppStack } from '../lib/fooder-app-stack';

describe('Frontend Construct', () => {
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

  it('creates an S3 bucket with public access blocked', () => {
    template.hasResourceProperties('AWS::S3::Bucket', {
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true,
      },
    });
  });

  it('creates a CloudFront distribution with default root object', () => {
    template.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: Match.objectLike({
        DefaultRootObject: 'index.html',
      }),
    });
  });

  it('creates an Origin Access Control for S3', () => {
    template.hasResourceProperties('AWS::CloudFront::OriginAccessControl', {
      OriginAccessControlConfig: Match.objectLike({
        OriginAccessControlOriginType: 's3',
        SigningBehavior: 'always',
        SigningProtocol: 'sigv4',
      }),
    });
  });

  it('configures SPA error pages to route to index.html', () => {
    template.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: Match.objectLike({
        CustomErrorResponses: Match.arrayWith([
          Match.objectLike({
            ErrorCode: 403,
            ResponseCode: 200,
            ResponsePagePath: '/index.html',
          }),
          Match.objectLike({
            ErrorCode: 404,
            ResponseCode: 200,
            ResponsePagePath: '/index.html',
          }),
        ]),
      }),
    });
  });

  it('exports SSM parameters for frontend bucket and domain', () => {
    template.hasResourceProperties('AWS::SSM::Parameter', {
      Name: '/test/fooder/frontend/admin/bucket-name',
    });
    template.hasResourceProperties('AWS::SSM::Parameter', {
      Name: '/test/fooder/frontend/admin/domain-name',
    });
  });
});
