import { Construct } from 'constructs';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as lambda from 'aws-cdk-lib/aws-lambda-nodejs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { CfnOutput, Duration, RemovalPolicy, SecretValue } from 'aws-cdk-lib';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import * as path from 'path';

export interface AuthConstructProps {
  stage: string;
  usersTableName: string;
  usersTableArn: string;
  piiKeyArn: string;
  googleClientId: string;
  googleClientSecret: string;
  adminEmailHashes: string;
  callbackUrls: string[];
  logoutUrls: string[];
}

export class AuthConstruct extends Construct {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;

  constructor(scope: Construct, id: string, props: AuthConstructProps) {
    super(scope, id);

    const {
      stage,
      usersTableName,
      usersTableArn,
      piiKeyArn,
      googleClientId,
      googleClientSecret,
      adminEmailHashes,
      callbackUrls,
      logoutUrls,
    } = props;

    // Post-confirmation Lambda
    const postConfirmationFn = new lambda.NodejsFunction(this, 'PostConfirmationFn', {
      entry: path.join(__dirname, '../../../api/src/handlers/auth/postConfirmation.ts'),
      handler: 'handler',
      runtime: Runtime.NODEJS_22_X,
      timeout: Duration.seconds(10),
      environment: {
        USERS_TABLE_NAME: usersTableName,
        PII_KEY_ARN: piiKeyArn,
        ADMIN_EMAIL_HASHES: adminEmailHashes,
      },
      bundling: {
        format: lambda.OutputFormat.ESM,
        mainFields: ['module', 'main'],
        esbuildArgs: { '--conditions': 'module' },
      },
    });

    // Grant Lambda permissions
    postConfirmationFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['dynamodb:PutItem', 'dynamodb:GetItem'],
        resources: [usersTableArn],
      }),
    );

    postConfirmationFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['kms:Encrypt', 'kms:Decrypt', 'kms:GenerateDataKey'],
        resources: [piiKeyArn],
      }),
    );

    // Cognito User Pool
    this.userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: `Fooder-${stage}-UserPool`,
      selfSignUpEnabled: true,
      autoVerify: { email: true },
      signInAliases: { email: true },
      standardAttributes: {
        email: { required: true, mutable: true },
        fullname: { required: false, mutable: true },
      },
      lambdaTriggers: {
        postConfirmation: postConfirmationFn,
      },
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // Google Identity Provider
    const googleProvider = new cognito.UserPoolIdentityProviderGoogle(this, 'GoogleProvider', {
      userPool: this.userPool,
      clientId: googleClientId,
      clientSecretValue: SecretValue.unsafePlainText(googleClientSecret),
      scopes: ['openid', 'email', 'profile'],
      attributeMapping: {
        email: cognito.ProviderAttribute.GOOGLE_EMAIL,
        fullname: cognito.ProviderAttribute.GOOGLE_NAME,
      },
    });

    // Hosted UI domain
    this.userPool.addDomain('CognitoDomain', {
      cognitoDomain: {
        domainPrefix: `fooder-${stage}`,
      },
    });

    // User Pool Client
    this.userPoolClient = this.userPool.addClient('UserPoolClient', {
      userPoolClientName: `Fooder-${stage}-Client`,
      oAuth: {
        flows: { authorizationCodeGrant: true },
        scopes: [
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.PROFILE,
        ],
        callbackUrls,
        logoutUrls,
      },
      supportedIdentityProviders: [
        cognito.UserPoolClientIdentityProvider.GOOGLE,
      ],
      generateSecret: false,
    });

    // Ensure the client depends on the Google provider
    this.userPoolClient.node.addDependency(googleProvider);

    // SSM parameter exports
    new ssm.StringParameter(this, 'UserPoolIdParam', {
      parameterName: `/${stage}/fooder/auth/user-pool-id`,
      stringValue: this.userPool.userPoolId,
    });

    new ssm.StringParameter(this, 'UserPoolClientIdParam', {
      parameterName: `/${stage}/fooder/auth/user-pool-client-id`,
      stringValue: this.userPoolClient.userPoolClientId,
    });

    // CfnOutputs
    new CfnOutput(this, 'UserPoolId', { value: this.userPool.userPoolId });
    new CfnOutput(this, 'UserPoolClientId', { value: this.userPoolClient.userPoolClientId });
  }
}
