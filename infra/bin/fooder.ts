#!/usr/bin/env node
import { App } from 'aws-cdk-lib';
import { FooderInfraStack } from '../lib/fooder-infra-stack';
import { FooderAppStack } from '../lib/fooder-app-stack';

const app = new App();

const stage = app.node.tryGetContext('stage') ?? 'dev';
const capitalStage = stage.charAt(0).toUpperCase() + stage.slice(1);

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION ?? 'us-east-1',
};

new FooderInfraStack(app, `Fooder-${capitalStage}-InfraStack`, {
  env,
  stage,
});

const googleClientId =
  app.node.tryGetContext('googleClientId') ??
  process.env.GOOGLE_CLIENT_ID ??
  'placeholder';

const googleClientSecret =
  app.node.tryGetContext('googleClientSecret') ??
  process.env.GOOGLE_CLIENT_SECRET ??
  'placeholder';

const adminEmailHashes =
  app.node.tryGetContext('adminEmailHashes') ??
  process.env.ADMIN_EMAIL_HASHES ??
  '';

new FooderAppStack(app, `Fooder-${capitalStage}-AppStack`, {
  env,
  stage,
  googleClientId,
  googleClientSecret,
  adminEmailHashes,
});
