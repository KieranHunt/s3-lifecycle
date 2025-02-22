#!/usr/bin/env -S npx tsx
import * as cdk from "aws-cdk-lib";
import { S3LifecycleStack } from "../lib/s3-lifecycle-stack";

const app = new cdk.App();
new S3LifecycleStack(app, "S3LifecycleStack", {});
