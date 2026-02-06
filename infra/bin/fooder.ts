#!/usr/bin/env node
import { App } from 'aws-cdk-lib';
import { FooderStack } from '../lib/fooder-stack';

const app = new App();

new FooderStack(app, 'FooderStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? 'us-east-1',
  },
});
