import { Stack, StackProps } from 'aws-cdk-lib';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';
import { AuthConstruct } from './constructs/auth';

export interface FooderAppStackProps extends StackProps {
  stage: string;
  googleClientId: string;
  googleClientSecret: string;
  adminEmailHashes: string;
  callbackUrls?: string[];
  logoutUrls?: string[];
}

export class FooderAppStack extends Stack {
  constructor(scope: Construct, id: string, props: FooderAppStackProps) {
    super(scope, id, props);

    const {
      stage,
      googleClientId,
      googleClientSecret,
      adminEmailHashes,
      callbackUrls = ['http://localhost:5173/auth/callback'],
      logoutUrls = ['http://localhost:5173/login'],
    } = props;

    // Read InfraStack exports via SSM
    const usersTableName = ssm.StringParameter.valueForStringParameter(
      this, `/${stage}/fooder/tables/users/name`,
    );
    const usersTableArn = ssm.StringParameter.valueForStringParameter(
      this, `/${stage}/fooder/tables/users/arn`,
    );
    const piiKeyArn = ssm.StringParameter.valueForStringParameter(
      this, `/${stage}/fooder/kms/pii-key/arn`,
    );

    new AuthConstruct(this, 'Auth', {
      stage,
      usersTableName,
      usersTableArn,
      piiKeyArn,
      googleClientId,
      googleClientSecret,
      adminEmailHashes,
      callbackUrls,
      logoutUrls,
    });

    // Will receive ApiConstruct (Phase 3) and FrontendConstruct (Phase 4-5)
  }
}
