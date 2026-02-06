import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { DatabaseConstruct } from './constructs/database';
import { KmsConstruct } from './constructs/kms';

export class FooderStack extends Stack {
  public readonly database: DatabaseConstruct;
  public readonly kms: KmsConstruct;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    this.kms = new KmsConstruct(this, 'Kms');
    this.database = new DatabaseConstruct(this, 'Database');
  }
}
