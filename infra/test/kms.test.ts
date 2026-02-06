import { App } from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { describe, it, beforeAll } from 'vitest';
import { FooderInfraStack } from '../lib/fooder-infra-stack';

describe('KMS Construct', () => {
  let template: Template;

  beforeAll(() => {
    const app = new App();
    const stack = new FooderInfraStack(app, 'TestStack', { stage: 'test' });
    template = Template.fromStack(stack);
  });

  it('creates a KMS key with alias alias/fooder/DEFAULT/pii', () => {
    template.hasResourceProperties('AWS::KMS::Alias', {
      AliasName: 'alias/fooder/DEFAULT/pii',
    });
  });

  it('has key rotation enabled', () => {
    template.hasResourceProperties('AWS::KMS::Key', {
      EnableKeyRotation: true,
    });
  });
});
