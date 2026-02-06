import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';

export interface FooderAppStackProps extends StackProps {
  stage: string;
}

export class FooderAppStack extends Stack {
  constructor(scope: Construct, id: string, props: FooderAppStackProps) {
    super(scope, id, props);

    // Will receive ApiConstruct (Phase 3) and FrontendConstruct (Phase 4-5)
  }
}
