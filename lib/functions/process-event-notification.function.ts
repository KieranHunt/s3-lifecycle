import { metricScope, StorageResolution, Unit } from "aws-embedded-metrics";
import { type S3Handler } from "aws-lambda";
import { checkNotNull } from "../check-not-null";

/**
 * {
 *   "Records": [
 *     {
 *       "eventVersion": "2.3",
 *       "eventSource": "aws:s3",
 *       "awsRegion": "us-east-1",
 *       "eventTime": "2024-12-09T15:57:00.927Z",
 *       "eventName": "LifecycleExpiration:Delete",
 *       "userIdentity": {
 *         "principalId": "s3.amazonaws.com"
 *       },
 *       "requestParameters": {
 *         "sourceIPAddress": "s3.amazonaws.com"
 *       },
 *       "responseElements": {
 *         "x-amz-request-id": "31D7DCBD5DBC7B6F",
 *         "x-amz-id-2": "BpK2zBABLVmjzOQgnkqN8bcf28nb7YdO19X5GofX2ZlETaPmfkYTfHgrLM/EInjR9N+oAR+htKjX9G7Z2/LCQjqrfgFk61b3"
 *       },
 *       "s3": {
 *         "s3SchemaVersion": "1.0",
 *         "configurationId": "MmE4YmUwNzYtYzY4Yi00MTFjLWFiNTUtYzkwYjAxNTI1ZWNh",
 *         "bucket": {
 *           "name": "s3lifecyclestack-lifecyclebucket0668f9ae-cktgybg2ysv8",
 *           "ownerIdentity": {
 *             "principalId": "A23D01POQ3ACM1"
 *           },
 *           "arn": "arn:aws:s3:::s3lifecyclestack-lifecyclebucket0668f9ae-cktgybg2ysv8"
 *         },
 *         "object": {
 *           "key": "2024-12-07T22%3A59%3A12.907Z",
 *           "sequencer": "006754D340F025B776"
 *         }
 *       }
 *     }
 *   ]
 * }
 *
 *
 * @param event
 */

export const handler: S3Handler = metricScope((metrics) => (event) => {
  console.log("Processing S3Event:", JSON.stringify(event, null, 2));

  const record = checkNotNull(event.Records[0]);

  const objectKey = decodeURIComponent(record.s3.object.key);

  const eventTime = new Date(record.eventTime);
  const objectCreateTime = new Date(objectKey);

  const timeDifference = eventTime.getTime() - objectCreateTime.getTime();

  metrics.putMetric("lifecycle-latency", timeDifference, Unit.Milliseconds, StorageResolution.Standard);
});
