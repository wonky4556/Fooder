import { App } from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { describe, it, expect, beforeAll } from 'vitest';
import { FooderInfraStack } from '../lib/fooder-infra-stack';

describe('Database Construct', () => {
  let template: Template;

  beforeAll(() => {
    const app = new App();
    const stack = new FooderInfraStack(app, 'TestStack', { stage: 'test' });
    template = Template.fromStack(stack);
  });

  describe('Users Table', () => {
    it('exists with tenantId PK and userId SK', () => {
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        KeySchema: [
          { AttributeName: 'tenantId', KeyType: 'HASH' },
          { AttributeName: 'userId', KeyType: 'RANGE' },
        ],
        AttributeDefinitions: Match.arrayWith([
          { AttributeName: 'tenantId', AttributeType: 'S' },
          { AttributeName: 'userId', AttributeType: 'S' },
        ]),
      });
    });

    it('has email-hash-index GSI', () => {
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        KeySchema: [
          { AttributeName: 'tenantId', KeyType: 'HASH' },
          { AttributeName: 'userId', KeyType: 'RANGE' },
        ],
        GlobalSecondaryIndexes: Match.arrayWith([
          Match.objectLike({
            IndexName: 'email-hash-index',
            KeySchema: [
              { AttributeName: 'emailHash', KeyType: 'HASH' },
            ],
          }),
        ]),
      });
    });
  });

  describe('MenuItems Table', () => {
    it('exists with tenantId PK and menuItemId SK', () => {
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        KeySchema: [
          { AttributeName: 'tenantId', KeyType: 'HASH' },
          { AttributeName: 'menuItemId', KeyType: 'RANGE' },
        ],
        AttributeDefinitions: Match.arrayWith([
          { AttributeName: 'tenantId', AttributeType: 'S' },
          { AttributeName: 'menuItemId', AttributeType: 'S' },
        ]),
      });
    });
  });

  describe('Schedules Table', () => {
    it('exists with tenantId PK and scheduleId SK', () => {
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        KeySchema: [
          { AttributeName: 'tenantId', KeyType: 'HASH' },
          { AttributeName: 'scheduleId', KeyType: 'RANGE' },
        ],
        AttributeDefinitions: Match.arrayWith([
          { AttributeName: 'tenantId', AttributeType: 'S' },
          { AttributeName: 'scheduleId', AttributeType: 'S' },
        ]),
      });
    });

    it('has schedule-status-index GSI', () => {
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        KeySchema: [
          { AttributeName: 'tenantId', KeyType: 'HASH' },
          { AttributeName: 'scheduleId', KeyType: 'RANGE' },
        ],
        GlobalSecondaryIndexes: Match.arrayWith([
          Match.objectLike({
            IndexName: 'schedule-status-index',
            KeySchema: [
              { AttributeName: 'tenantId', KeyType: 'HASH' },
              { AttributeName: 'statusStartTime', KeyType: 'RANGE' },
            ],
          }),
        ]),
      });
    });
  });

  describe('Orders Table', () => {
    it('exists with composite PK tenantId#scheduleId and orderId SK', () => {
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        KeySchema: [
          { AttributeName: 'pk', KeyType: 'HASH' },
          { AttributeName: 'orderId', KeyType: 'RANGE' },
        ],
        AttributeDefinitions: Match.arrayWith([
          { AttributeName: 'pk', AttributeType: 'S' },
          { AttributeName: 'orderId', AttributeType: 'S' },
        ]),
      });
    });

    it('has user-orders-index GSI', () => {
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        KeySchema: [
          { AttributeName: 'pk', KeyType: 'HASH' },
          { AttributeName: 'orderId', KeyType: 'RANGE' },
        ],
        GlobalSecondaryIndexes: Match.arrayWith([
          Match.objectLike({
            IndexName: 'user-orders-index',
            KeySchema: [
              { AttributeName: 'tenantUserId', KeyType: 'HASH' },
              { AttributeName: 'createdAt', KeyType: 'RANGE' },
            ],
          }),
        ]),
      });
    });

    it('has order-status-index GSI', () => {
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        KeySchema: [
          { AttributeName: 'pk', KeyType: 'HASH' },
          { AttributeName: 'orderId', KeyType: 'RANGE' },
        ],
        GlobalSecondaryIndexes: Match.arrayWith([
          Match.objectLike({
            IndexName: 'order-status-index',
            KeySchema: [
              { AttributeName: 'tenantId', KeyType: 'HASH' },
              { AttributeName: 'statusCreatedAt', KeyType: 'RANGE' },
            ],
          }),
        ]),
      });
    });
  });

  describe('All Tables', () => {
    it('use PAY_PER_REQUEST billing', () => {
      const tables = template.findResources('AWS::DynamoDB::Table');
      const tableKeys = Object.keys(tables);
      expect(tableKeys.length).toBeGreaterThanOrEqual(4);

      for (const key of tableKeys) {
        expect(tables[key].Properties.BillingMode).toBe('PAY_PER_REQUEST');
      }
    });

    it('have point-in-time recovery enabled', () => {
      const tables = template.findResources('AWS::DynamoDB::Table');
      const tableKeys = Object.keys(tables);

      for (const key of tableKeys) {
        expect(tables[key].Properties.PointInTimeRecoverySpecification).toEqual({
          PointInTimeRecoveryEnabled: true,
        });
      }
    });
  });
});
