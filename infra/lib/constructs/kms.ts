import { Construct } from 'constructs';
import * as kms from 'aws-cdk-lib/aws-kms';
import { RemovalPolicy } from 'aws-cdk-lib';

export class KmsConstruct extends Construct {
  public readonly piiKey: kms.Key;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    this.piiKey = new kms.Key(this, 'PiiEncryptionKey', {
      description: 'KMS key for encrypting PII data in Fooder',
      enableKeyRotation: true,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    this.piiKey.addAlias('alias/fooder/DEFAULT/pii');
  }
}
