import { Construct } from 'constructs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as lambda from 'aws-cdk-lib/aws-lambda-nodejs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { CfnOutput, Duration } from 'aws-cdk-lib';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import * as path from 'path';

export interface ApiConstructProps {
  stage: string;
  userPool: cognito.IUserPool;
  usersTableName: string;
  usersTableArn: string;
  menuItemsTableName: string;
  menuItemsTableArn: string;
  schedulesTableName: string;
  schedulesTableArn: string;
  piiKeyArn: string;
}

export class ApiConstruct extends Construct {
  public readonly api: apigateway.RestApi;

  constructor(scope: Construct, id: string, props: ApiConstructProps) {
    super(scope, id);

    const {
      stage,
      userPool,
      usersTableName,
      usersTableArn,
      menuItemsTableName,
      menuItemsTableArn,
      schedulesTableName,
      schedulesTableArn,
      piiKeyArn,
    } = props;

    // REST API
    this.api = new apigateway.RestApi(this, 'RestApi', {
      restApiName: `fooder-${stage}-api`,
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization'],
      },
    });

    // Cognito Authorizer
    const authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'CognitoAuthorizer', {
      cognitoUserPools: [userPool],
      authorizerName: `fooder-${stage}-authorizer`,
    });

    const authMethodOptions: apigateway.MethodOptions = {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    };

    // --- Lambda Functions ---

    // getMe
    const getMeFn = this.createHandlerFn('GetMeFn', 'auth/getMe.ts', {
      USERS_TABLE_NAME: usersTableName,
      PII_KEY_ARN: piiKeyArn,
    });
    getMeFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['dynamodb:GetItem'],
      resources: [usersTableArn],
    }));
    getMeFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['kms:Encrypt', 'kms:Decrypt', 'kms:GenerateDataKey'],
      resources: [piiKeyArn],
    }));

    // Menu item handlers
    const createMenuItemFn = this.createMenuFn('CreateMenuItemFn', 'menu/createMenuItem.ts', usersTableName, menuItemsTableName);
    const listMenuItemsFn = this.createMenuFn('ListMenuItemsFn', 'menu/listMenuItems.ts', usersTableName, menuItemsTableName);
    const getMenuItemFn = this.createMenuFn('GetMenuItemFn', 'menu/getMenuItem.ts', usersTableName, menuItemsTableName);
    const updateMenuItemFn = this.createMenuFn('UpdateMenuItemFn', 'menu/updateMenuItem.ts', usersTableName, menuItemsTableName);
    const deleteMenuItemFn = this.createMenuFn('DeleteMenuItemFn', 'menu/deleteMenuItem.ts', usersTableName, menuItemsTableName);

    // Grant menu Lambdas DynamoDB permissions
    for (const fn of [createMenuItemFn, listMenuItemsFn, getMenuItemFn, updateMenuItemFn, deleteMenuItemFn]) {
      fn.addToRolePolicy(new iam.PolicyStatement({
        actions: ['dynamodb:GetItem'],
        resources: [usersTableArn],
      }));
      fn.addToRolePolicy(new iam.PolicyStatement({
        actions: ['dynamodb:PutItem', 'dynamodb:GetItem', 'dynamodb:Query', 'dynamodb:UpdateItem', 'dynamodb:DeleteItem'],
        resources: [menuItemsTableArn],
      }));
    }

    // Schedule handlers
    const createScheduleFn = this.createScheduleFn('CreateScheduleFn', 'schedule/createSchedule.ts', usersTableName, menuItemsTableName, schedulesTableName);
    const listSchedulesFn = this.createHandlerFn('ListSchedulesFn', 'schedule/listSchedules.ts', {
      USERS_TABLE_NAME: usersTableName,
      SCHEDULES_TABLE_NAME: schedulesTableName,
    });
    const getScheduleFn = this.createHandlerFn('GetScheduleFn', 'schedule/getSchedule.ts', {
      USERS_TABLE_NAME: usersTableName,
      SCHEDULES_TABLE_NAME: schedulesTableName,
    });
    const updateScheduleFn = this.createHandlerFn('UpdateScheduleFn', 'schedule/updateSchedule.ts', {
      USERS_TABLE_NAME: usersTableName,
      SCHEDULES_TABLE_NAME: schedulesTableName,
    });
    const deleteScheduleFn = this.createHandlerFn('DeleteScheduleFn', 'schedule/deleteSchedule.ts', {
      USERS_TABLE_NAME: usersTableName,
      SCHEDULES_TABLE_NAME: schedulesTableName,
    });

    // Grant schedule Lambdas DynamoDB permissions
    for (const fn of [listSchedulesFn, getScheduleFn, updateScheduleFn, deleteScheduleFn]) {
      fn.addToRolePolicy(new iam.PolicyStatement({
        actions: ['dynamodb:GetItem'],
        resources: [usersTableArn],
      }));
      fn.addToRolePolicy(new iam.PolicyStatement({
        actions: ['dynamodb:PutItem', 'dynamodb:GetItem', 'dynamodb:Query', 'dynamodb:UpdateItem', 'dynamodb:DeleteItem'],
        resources: [schedulesTableArn, `${schedulesTableArn}/index/*`],
      }));
    }

    // createSchedule needs Users + MenuItems (read) + Schedules (write)
    createScheduleFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['dynamodb:GetItem'],
      resources: [usersTableArn],
    }));
    createScheduleFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['dynamodb:BatchGetItem', 'dynamodb:GetItem'],
      resources: [menuItemsTableArn],
    }));
    createScheduleFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['dynamodb:PutItem'],
      resources: [schedulesTableArn],
    }));

    // --- API Gateway Resources ---

    const apiResource = this.api.root.addResource('api');

    // /api/me
    const meResource = apiResource.addResource('me');
    meResource.addMethod('GET', new apigateway.LambdaIntegration(getMeFn), authMethodOptions);

    // /api/menu-items
    const menuItemsResource = apiResource.addResource('menu-items');
    menuItemsResource.addMethod('GET', new apigateway.LambdaIntegration(listMenuItemsFn), authMethodOptions);
    menuItemsResource.addMethod('POST', new apigateway.LambdaIntegration(createMenuItemFn), authMethodOptions);

    // /api/menu-items/{id}
    const menuItemResource = menuItemsResource.addResource('{id}');
    menuItemResource.addMethod('GET', new apigateway.LambdaIntegration(getMenuItemFn), authMethodOptions);
    menuItemResource.addMethod('PUT', new apigateway.LambdaIntegration(updateMenuItemFn), authMethodOptions);
    menuItemResource.addMethod('DELETE', new apigateway.LambdaIntegration(deleteMenuItemFn), authMethodOptions);

    // /api/schedules
    const schedulesResource = apiResource.addResource('schedules');
    schedulesResource.addMethod('GET', new apigateway.LambdaIntegration(listSchedulesFn), authMethodOptions);
    schedulesResource.addMethod('POST', new apigateway.LambdaIntegration(createScheduleFn), authMethodOptions);

    // /api/schedules/{id}
    const scheduleResource = schedulesResource.addResource('{id}');
    scheduleResource.addMethod('GET', new apigateway.LambdaIntegration(getScheduleFn), authMethodOptions);
    scheduleResource.addMethod('PUT', new apigateway.LambdaIntegration(updateScheduleFn), authMethodOptions);
    scheduleResource.addMethod('DELETE', new apigateway.LambdaIntegration(deleteScheduleFn), authMethodOptions);

    // SSM parameter export
    new ssm.StringParameter(this, 'ApiUrlParam', {
      parameterName: `/${stage}/fooder/api/url`,
      stringValue: this.api.url,
    });

    // CfnOutput
    new CfnOutput(this, 'ApiUrl', { value: this.api.url });
  }

  private createHandlerFn(
    id: string,
    handlerPath: string,
    environment: Record<string, string>,
  ): lambda.NodejsFunction {
    return new lambda.NodejsFunction(this, id, {
      entry: path.join(__dirname, `../../../api/src/handlers/${handlerPath}`),
      handler: 'handler',
      runtime: Runtime.NODEJS_22_X,
      timeout: Duration.seconds(10),
      environment,
      bundling: {
        format: lambda.OutputFormat.ESM,
        mainFields: ['module', 'main'],
        esbuildArgs: { '--conditions': 'module' },
      },
    });
  }

  private createMenuFn(
    id: string,
    handlerPath: string,
    usersTableName: string,
    menuItemsTableName: string,
  ): lambda.NodejsFunction {
    return this.createHandlerFn(id, handlerPath, {
      USERS_TABLE_NAME: usersTableName,
      MENU_ITEMS_TABLE_NAME: menuItemsTableName,
    });
  }

  private createScheduleFn(
    id: string,
    handlerPath: string,
    usersTableName: string,
    menuItemsTableName: string,
    schedulesTableName: string,
  ): lambda.NodejsFunction {
    return this.createHandlerFn(id, handlerPath, {
      USERS_TABLE_NAME: usersTableName,
      MENU_ITEMS_TABLE_NAME: menuItemsTableName,
      SCHEDULES_TABLE_NAME: schedulesTableName,
    });
  }
}
