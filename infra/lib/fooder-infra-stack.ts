import { Stack, StackProps, CfnOutput } from 'aws-cdk-lib';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';
import { DatabaseConstruct } from './constructs/database';
import { KmsConstruct } from './constructs/kms';

export interface FooderInfraStackProps extends StackProps {
  stage: string;
}

export class FooderInfraStack extends Stack {
  public readonly database: DatabaseConstruct;
  public readonly kms: KmsConstruct;

  constructor(scope: Construct, id: string, props: FooderInfraStackProps) {
    super(scope, id, props);

    const { stage } = props;

    this.kms = new KmsConstruct(this, 'Kms');
    this.database = new DatabaseConstruct(this, 'Database');

    // SSM parameter exports for cross-stack references
    new ssm.StringParameter(this, 'UsersTableNameParam', {
      parameterName: `/${stage}/fooder/tables/users/name`,
      stringValue: this.database.usersTable.tableName,
    });
    new ssm.StringParameter(this, 'UsersTableArnParam', {
      parameterName: `/${stage}/fooder/tables/users/arn`,
      stringValue: this.database.usersTable.tableArn,
    });

    new ssm.StringParameter(this, 'MenuItemsTableNameParam', {
      parameterName: `/${stage}/fooder/tables/menu-items/name`,
      stringValue: this.database.menuItemsTable.tableName,
    });
    new ssm.StringParameter(this, 'MenuItemsTableArnParam', {
      parameterName: `/${stage}/fooder/tables/menu-items/arn`,
      stringValue: this.database.menuItemsTable.tableArn,
    });

    new ssm.StringParameter(this, 'SchedulesTableNameParam', {
      parameterName: `/${stage}/fooder/tables/schedules/name`,
      stringValue: this.database.schedulesTable.tableName,
    });
    new ssm.StringParameter(this, 'SchedulesTableArnParam', {
      parameterName: `/${stage}/fooder/tables/schedules/arn`,
      stringValue: this.database.schedulesTable.tableArn,
    });

    new ssm.StringParameter(this, 'OrdersTableNameParam', {
      parameterName: `/${stage}/fooder/tables/orders/name`,
      stringValue: this.database.ordersTable.tableName,
    });
    new ssm.StringParameter(this, 'OrdersTableArnParam', {
      parameterName: `/${stage}/fooder/tables/orders/arn`,
      stringValue: this.database.ordersTable.tableArn,
    });

    new ssm.StringParameter(this, 'PiiKeyArnParam', {
      parameterName: `/${stage}/fooder/kms/pii-key/arn`,
      stringValue: this.kms.piiKey.keyArn,
    });

    // CfnOutputs for visibility
    new CfnOutput(this, 'UsersTableName', { value: this.database.usersTable.tableName });
    new CfnOutput(this, 'MenuItemsTableName', { value: this.database.menuItemsTable.tableName });
    new CfnOutput(this, 'SchedulesTableName', { value: this.database.schedulesTable.tableName });
    new CfnOutput(this, 'OrdersTableName', { value: this.database.ordersTable.tableName });
    new CfnOutput(this, 'PiiKeyArn', { value: this.kms.piiKey.keyArn });
  }
}
