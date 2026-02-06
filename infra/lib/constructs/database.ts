import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { RemovalPolicy } from 'aws-cdk-lib';

export class DatabaseConstruct extends Construct {
  public readonly usersTable: dynamodb.Table;
  public readonly menuItemsTable: dynamodb.Table;
  public readonly schedulesTable: dynamodb.Table;
  public readonly ordersTable: dynamodb.Table;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    // Users Table
    this.usersTable = new dynamodb.Table(this, 'UsersTable', {
      partitionKey: { name: 'tenantId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      removalPolicy: RemovalPolicy.DESTROY,
    });

    this.usersTable.addGlobalSecondaryIndex({
      indexName: 'email-hash-index',
      partitionKey: { name: 'emailHash', type: dynamodb.AttributeType.STRING },
    });

    // MenuItems Table
    this.menuItemsTable = new dynamodb.Table(this, 'MenuItemsTable', {
      partitionKey: { name: 'tenantId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'menuItemId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // Schedules Table
    this.schedulesTable = new dynamodb.Table(this, 'SchedulesTable', {
      partitionKey: { name: 'tenantId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'scheduleId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      removalPolicy: RemovalPolicy.DESTROY,
    });

    this.schedulesTable.addGlobalSecondaryIndex({
      indexName: 'schedule-status-index',
      partitionKey: { name: 'tenantId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'statusStartTime', type: dynamodb.AttributeType.STRING },
    });

    // Orders Table (composite PK: tenantId#scheduleId)
    this.ordersTable = new dynamodb.Table(this, 'OrdersTable', {
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'orderId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      removalPolicy: RemovalPolicy.DESTROY,
    });

    this.ordersTable.addGlobalSecondaryIndex({
      indexName: 'user-orders-index',
      partitionKey: { name: 'tenantUserId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'createdAt', type: dynamodb.AttributeType.STRING },
    });

    this.ordersTable.addGlobalSecondaryIndex({
      indexName: 'order-status-index',
      partitionKey: { name: 'tenantId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'statusCreatedAt', type: dynamodb.AttributeType.STRING },
    });
  }
}
