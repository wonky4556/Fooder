import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as iam from 'aws-cdk-lib/aws-iam';
import { CfnOutput, RemovalPolicy } from 'aws-cdk-lib';

export interface FrontendConstructProps {
  stage: string;
  appName: string;
}

export class FrontendConstruct extends Construct {
  public readonly bucket: s3.Bucket;
  public readonly distribution: cloudfront.Distribution;

  constructor(scope: Construct, id: string, props: FrontendConstructProps) {
    super(scope, id);

    const { stage, appName } = props;
    const isProd = stage === 'prod';
    const capitalizedAppName = appName.charAt(0).toUpperCase() + appName.slice(1);

    // S3 Bucket
    this.bucket = new s3.Bucket(this, 'Bucket', {
      bucketName: `fooder-${stage}-${appName}-assets`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: isProd ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
      autoDeleteObjects: !isProd,
    });

    // CloudFront Origin Access Control
    const oac = new cloudfront.CfnOriginAccessControl(this, 'OAC', {
      originAccessControlConfig: {
        name: `fooder-${stage}-${appName}-oac`,
        originAccessControlOriginType: 's3',
        signingBehavior: 'always',
        signingProtocol: 'sigv4',
      },
    });

    // CloudFront Distribution
    this.distribution = new cloudfront.Distribution(this, 'Distribution', {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(this.bucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      defaultRootObject: 'index.html',
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
        },
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
        },
      ],
    });

    // CfnOutputs — logical IDs must match deploy workflow expectations
    // (deploy-dev.yml uses get_output AdminBucketName, AdminDistributionId, etc.)
    const bucketOutput = new CfnOutput(this, 'BucketName', {
      value: this.bucket.bucketName,
    });
    bucketOutput.overrideLogicalId(`${capitalizedAppName}BucketName`);

    const distIdOutput = new CfnOutput(this, 'DistributionId', {
      value: this.distribution.distributionId,
    });
    distIdOutput.overrideLogicalId(`${capitalizedAppName}DistributionId`);

    const domainOutput = new CfnOutput(this, 'DomainName', {
      value: this.distribution.distributionDomainName,
    });
    domainOutput.overrideLogicalId(`${capitalizedAppName}DomainName`);

    // SSM Parameters
    new ssm.StringParameter(this, 'BucketNameParam', {
      parameterName: `/${stage}/fooder/frontend/${appName}/bucket-name`,
      stringValue: this.bucket.bucketName,
    });
    new ssm.StringParameter(this, 'DistributionIdParam', {
      parameterName: `/${stage}/fooder/frontend/${appName}/distribution-id`,
      stringValue: this.distribution.distributionId,
    });
    new ssm.StringParameter(this, 'DomainNameParam', {
      parameterName: `/${stage}/fooder/frontend/${appName}/domain-name`,
      stringValue: this.distribution.distributionDomainName,
    });
  }
}
