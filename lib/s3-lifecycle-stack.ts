import * as cdk from "aws-cdk-lib";
import { Duration } from "aws-cdk-lib";
import { Rule, Schedule } from "aws-cdk-lib/aws-events";
import { LambdaFunction } from "aws-cdk-lib/aws-events-targets";
import { Effect, PolicyStatement } from "aws-cdk-lib/aws-iam";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Bucket, EventType } from "aws-cdk-lib/aws-s3";
import { LambdaDestination } from "aws-cdk-lib/aws-s3-notifications";
import { Construct } from "constructs";
import { join } from "node:path";
import { checkNotNull } from "./check-not-null";

export class S3LifecycleStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const putObjectRule = new Rule(this, "PutObjectRule", {
      schedule: Schedule.rate(Duration.minutes(1)),
    });

    const objectPutterFunction = new NodejsFunction(this, "ObjectPutterFunction", {
      entry: join(__dirname, "functions", "put-object.function.ts"),
      handler: "handler",
    });

    putObjectRule.addTarget(new LambdaFunction(objectPutterFunction));

    const bucket = new Bucket(this, "LifecycleBucket", {
      lifecycleRules: [
        {
          expiration: Duration.days(1),
        },
      ],
      enforceSSL: true,
    });

    bucket.grantWrite(objectPutterFunction);

    objectPutterFunction.addEnvironment("BUCKET_NAME", bucket.bucketName);

    const eventNotificationProcessor = new NodejsFunction(this, "EventNotificationProcessorFunction", {
      entry: join(__dirname, "functions", "process-event-notification.function.ts"),
      handler: "handler",
    });

    bucket.addEventNotification(EventType.LIFECYCLE_EXPIRATION, new LambdaDestination(eventNotificationProcessor));

    const getMetricWidgetImageRule = new Rule(this, "GetMetricWidgetImageRule", {
      schedule: Schedule.rate(Duration.minutes(1)),
    });

    const getMetricWidgetImageFunction = new NodejsFunction(this, "GetMetricWidgetImageFunction", {
      entry: join(__dirname, "functions", "get-metric-widget-image.function.ts"),
      handler: "handler",
      environment: {
        EVENT_NOTIFICATION_PROCESSOR_FUNCTION_NAME: eventNotificationProcessor.functionName,
      },
      timeout: Duration.seconds(30),
    });

    getMetricWidgetImageRule.addTarget(new LambdaFunction(getMetricWidgetImageFunction));

    const metricBucket = new Bucket(this, "MetricBucket", {
      enforceSSL: true,
      publicReadAccess: true,
      blockPublicAccess: {
        blockPublicPolicy: false,
        blockPublicAcls: false,
        ignorePublicAcls: false,
        restrictPublicBuckets: false,
      },
    });

    getMetricWidgetImageFunction.addEnvironment("BUCKET_NAME", metricBucket.bucketName);

    metricBucket.grantPut(getMetricWidgetImageFunction);

    checkNotNull(getMetricWidgetImageFunction.role).addToPrincipalPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ["cloudwatch:GetMetricWidgetImage"],
        resources: ["*"],
      }),
    );
  }
}
