import {
  CloudWatchClient,
  GetMetricWidgetImageCommand,
} from "@aws-sdk/client-cloudwatch";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { EventBridgeEvent } from "aws-lambda";
import { z } from "zod";

const cloudwatchClient = new CloudWatchClient({
  region: process.env.AWS_REGION,
});

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
});

export const handler = async (
  event: EventBridgeEvent<any, any>
): Promise<void> => {
  console.log("Processing EventBrigdeEvent:", JSON.stringify(event, null, 2));

  const environmentVariables = z
    .object({
      BUCKET_NAME: z.string(),
      AWS_REGION: z.string(),
      EVENT_NOTIFICATION_PROCESSOR_FUNCTION_NAME: z.string(),
    })
    .parse(process.env);

  const getLatencyMetricWidgetImageInput = {
    MetricWidget: JSON.stringify({
      metrics: [
        [
          {
            expression: "m1 / 1000 / 60 / 60",
            label: "Minimum Latency",
            id: "e1",
          },
        ],
        [
          {
            expression: "m2 / 1000 / 60 / 60",
            label: "Median Latency",
            id: "e2",
          },
        ],
        [
          {
            expression: "m3 / 1000 / 60 / 60",
            label: "Maximum latency",
            id: "e3",
          },
        ],
        [
          "aws-embedded-metrics",
          "lifecycle-latency",
          "LogGroup",
          environmentVariables.EVENT_NOTIFICATION_PROCESSOR_FUNCTION_NAME,
          "ServiceName",
          environmentVariables.EVENT_NOTIFICATION_PROCESSOR_FUNCTION_NAME,
          "ServiceType",
          "AWS::Lambda::Function",
          { stat: "Minimum", id: "m1", visible: false },
        ],
        ["...", { stat: "p50", id: "m2", visible: false }],
        ["...", { stat: "Maximum", id: "m3", visible: false }],
      ],
      view: "timeSeries",
      stacked: false,
      region: environmentVariables.AWS_REGION,
      period: 3600,
      start: "-P1M",
      yAxis: {
        left: {
          min: 0,
          showUnits: false,
          label: "Hours",
        },
      },
      liveData: false,
      setPeriodToTimeRange: true,
      title: `S3 Lifecycle Latency (updated @ ${new Date().toISOString()})`,
      width: 768,
      height: 384,
      theme: "dark",
    }),
  };

  console.log({ getLatencyMetricWidgetImageInput });

  const getLatencyMetricWidgetImageOutput = await cloudwatchClient.send(
    new GetMetricWidgetImageCommand(getLatencyMetricWidgetImageInput)
  );

  await s3Client.send(
    new PutObjectCommand({
      Bucket: process.env.BUCKET_NAME,
      Key: "s3-latency.png",
      Body: getLatencyMetricWidgetImageOutput.MetricWidgetImage,
      ContentEncoding: "base64",
      ContentType: "image/png",
    })
  );
};
