import { Stack, StackProps } from 'aws-cdk-lib';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';
import { AuthConstruct } from './constructs/auth';
import { ApiConstruct } from './constructs/api';
import { FrontendConstruct } from './constructs/frontend';

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
    const menuItemsTableName = ssm.StringParameter.valueForStringParameter(
      this, `/${stage}/fooder/tables/menu-items/name`,
    );
    const menuItemsTableArn = ssm.StringParameter.valueForStringParameter(
      this, `/${stage}/fooder/tables/menu-items/arn`,
    );
    const schedulesTableName = ssm.StringParameter.valueForStringParameter(
      this, `/${stage}/fooder/tables/schedules/name`,
    );
    const schedulesTableArn = ssm.StringParameter.valueForStringParameter(
      this, `/${stage}/fooder/tables/schedules/arn`,
    );
    const piiKeyArn = ssm.StringParameter.valueForStringParameter(
      this, `/${stage}/fooder/kms/pii-key/arn`,
    );

    const auth = new AuthConstruct(this, 'Auth', {
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

    new ApiConstruct(this, 'Api', {
      stage,
      userPool: auth.userPool,
      usersTableName,
      usersTableArn,
      menuItemsTableName,
      menuItemsTableArn,
      schedulesTableName,
      schedulesTableArn,
      piiKeyArn,
    });

    new FrontendConstruct(this, 'AdminFrontend', {
      stage,
      appName: 'admin',
    });
  }
}
