import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { type EventBridgeEvent } from "aws-lambda";

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
});

export const handler = async (event: EventBridgeEvent<string, string>): Promise<void> => {
  console.log("Processing EventBridgeEvent:", JSON.stringify(event, null, 2));

  const now = new Date();

  await s3Client.send(
    new PutObjectCommand({
      Bucket: process.env.BUCKET_NAME,
      Key: now.toISOString(),
      ContentType: "text/plain",
    }),
  );
};
