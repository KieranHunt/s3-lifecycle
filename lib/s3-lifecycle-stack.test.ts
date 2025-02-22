import { describe, expect, test } from '@jest/globals';
import { App } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { Construct } from 'constructs';
import { S3LifecycleStack } from './s3-lifecycle-stack';

describe(S3LifecycleStack, () => {
  test('matches the snapshot', () => {
  	const app = new App();
  	const topicsStack = new S3LifecycleStack(app, "S3LifecycleStack");

    const prodTemplate = Template.fromStack(topicsStack);

    expect(prodTemplate.toJSON()).toMatchInlineSnapshot(`
{
  "Parameters": {
    "BootstrapVersion": {
      "Default": "/cdk-bootstrap/hnb659fds/version",
      "Description": "Version of the CDK Bootstrap resources in this environment, automatically retrieved from SSM Parameter Store. [cdk:skip]",
      "Type": "AWS::SSM::Parameter::Value<String>",
    },
  },
  "Resources": {
    "BucketNotificationsHandler050a0587b7544547bf325f094a3db8347ECC3691": {
      "DependsOn": [
        "BucketNotificationsHandler050a0587b7544547bf325f094a3db834RoleDefaultPolicy2CF63D36",
        "BucketNotificationsHandler050a0587b7544547bf325f094a3db834RoleB6FB88EC",
      ],
      "Properties": {
        "Code": {
          "ZipFile": "import boto3  # type: ignore
import json
import logging
import urllib.request

s3 = boto3.client("s3")

EVENTBRIDGE_CONFIGURATION = 'EventBridgeConfiguration'
CONFIGURATION_TYPES = ["TopicConfigurations", "QueueConfigurations", "LambdaFunctionConfigurations"]

def handler(event: dict, context):
  response_status = "SUCCESS"
  error_message = ""
  try:
    props = event["ResourceProperties"]
    notification_configuration = props["NotificationConfiguration"]
    managed = props.get('Managed', 'true').lower() == 'true'
    skipDestinationValidation = props.get('SkipDestinationValidation', 'false').lower() == 'true'
    stack_id = event['StackId']
    old = event.get("OldResourceProperties", {}).get("NotificationConfiguration", {})
    if managed:
      config = handle_managed(event["RequestType"], notification_configuration)
    else:
      config = handle_unmanaged(props["BucketName"], stack_id, event["RequestType"], notification_configuration, old)
    s3.put_bucket_notification_configuration(Bucket=props["BucketName"], NotificationConfiguration=config, SkipDestinationValidation=skipDestinationValidation)
  except Exception as e:
    logging.exception("Failed to put bucket notification configuration")
    response_status = "FAILED"
    error_message = f"Error: {str(e)}. "
  finally:
    submit_response(event, context, response_status, error_message)

def handle_managed(request_type, notification_configuration):
  if request_type == 'Delete':
    return {}
  return notification_configuration

def handle_unmanaged(bucket, stack_id, request_type, notification_configuration, old):
  def get_id(n):
    n['Id'] = ''
    sorted_notifications = sort_filter_rules(n)
    strToHash=json.dumps(sorted_notifications, sort_keys=True).replace('"Name": "prefix"', '"Name": "Prefix"').replace('"Name": "suffix"', '"Name": "Suffix"')
    return f"{stack_id}-{hash(strToHash)}"
  def with_id(n):
    n['Id'] = get_id(n)
    return n

  external_notifications = {}
  existing_notifications = s3.get_bucket_notification_configuration(Bucket=bucket)
  for t in CONFIGURATION_TYPES:
    if request_type == 'Update':
        old_incoming_ids = [get_id(n) for n in old.get(t, [])]
        external_notifications[t] = [n for n in existing_notifications.get(t, []) if not get_id(n) in old_incoming_ids]      
    elif request_type == 'Delete':
        external_notifications[t] = [n for n in existing_notifications.get(t, []) if not n['Id'].startswith(f"{stack_id}-")]
    elif request_type == 'Create':
        external_notifications[t] = [n for n in existing_notifications.get(t, [])]
  if EVENTBRIDGE_CONFIGURATION in existing_notifications:
    external_notifications[EVENTBRIDGE_CONFIGURATION] = existing_notifications[EVENTBRIDGE_CONFIGURATION]

  if request_type == 'Delete':
    return external_notifications

  notifications = {}
  for t in CONFIGURATION_TYPES:
    external = external_notifications.get(t, [])
    incoming = [with_id(n) for n in notification_configuration.get(t, [])]
    notifications[t] = external + incoming

  if EVENTBRIDGE_CONFIGURATION in notification_configuration:
    notifications[EVENTBRIDGE_CONFIGURATION] = notification_configuration[EVENTBRIDGE_CONFIGURATION]
  elif EVENTBRIDGE_CONFIGURATION in external_notifications:
    notifications[EVENTBRIDGE_CONFIGURATION] = external_notifications[EVENTBRIDGE_CONFIGURATION]

  return notifications

def submit_response(event: dict, context, response_status: str, error_message: str):
  response_body = json.dumps(
    {
      "Status": response_status,
      "Reason": f"{error_message}See the details in CloudWatch Log Stream: {context.log_stream_name}",
      "PhysicalResourceId": event.get("PhysicalResourceId") or event["LogicalResourceId"],
      "StackId": event["StackId"],
      "RequestId": event["RequestId"],
      "LogicalResourceId": event["LogicalResourceId"],
      "NoEcho": False,
    }
  ).encode("utf-8")
  headers = {"content-type": "", "content-length": str(len(response_body))}
  try:
    req = urllib.request.Request(url=event["ResponseURL"], headers=headers, data=response_body, method="PUT")
    with urllib.request.urlopen(req) as response:
      print(response.read().decode("utf-8"))
    print("Status code: " + response.reason)
  except Exception as e:
      print("send(..) failed executing request.urlopen(..): " + str(e))

def sort_filter_rules(json_obj):
  if not isinstance(json_obj, dict):
      return json_obj
  for key, value in json_obj.items():
      if isinstance(value, dict):
          json_obj[key] = sort_filter_rules(value)
      elif isinstance(value, list):
          json_obj[key] = [sort_filter_rules(item) for item in value]
  if "Filter" in json_obj and "Key" in json_obj["Filter"] and "FilterRules" in json_obj["Filter"]["Key"]:
      filter_rules = json_obj["Filter"]["Key"]["FilterRules"]
      sorted_filter_rules = sorted(filter_rules, key=lambda x: x["Name"])
      json_obj["Filter"]["Key"]["FilterRules"] = sorted_filter_rules
  return json_obj",
        },
        "Description": "AWS CloudFormation handler for "Custom::S3BucketNotifications" resources (@aws-cdk/aws-s3)",
        "Handler": "index.handler",
        "Role": {
          "Fn::GetAtt": [
            "BucketNotificationsHandler050a0587b7544547bf325f094a3db834RoleB6FB88EC",
            "Arn",
          ],
        },
        "Runtime": "python3.11",
        "Timeout": 300,
      },
      "Type": "AWS::Lambda::Function",
    },
    "BucketNotificationsHandler050a0587b7544547bf325f094a3db834RoleB6FB88EC": {
      "Properties": {
        "AssumeRolePolicyDocument": {
          "Statement": [
            {
              "Action": "sts:AssumeRole",
              "Effect": "Allow",
              "Principal": {
                "Service": "lambda.amazonaws.com",
              },
            },
          ],
          "Version": "2012-10-17",
        },
        "ManagedPolicyArns": [
          {
            "Fn::Join": [
              "",
              [
                "arn:",
                {
                  "Ref": "AWS::Partition",
                },
                ":iam::aws:policy/service-role/AWSLambdaBasicExecutionRole",
              ],
            ],
          },
        ],
      },
      "Type": "AWS::IAM::Role",
    },
    "BucketNotificationsHandler050a0587b7544547bf325f094a3db834RoleDefaultPolicy2CF63D36": {
      "Properties": {
        "PolicyDocument": {
          "Statement": [
            {
              "Action": "s3:PutBucketNotification",
              "Effect": "Allow",
              "Resource": "*",
            },
          ],
          "Version": "2012-10-17",
        },
        "PolicyName": "BucketNotificationsHandler050a0587b7544547bf325f094a3db834RoleDefaultPolicy2CF63D36",
        "Roles": [
          {
            "Ref": "BucketNotificationsHandler050a0587b7544547bf325f094a3db834RoleB6FB88EC",
          },
        ],
      },
      "Type": "AWS::IAM::Policy",
    },
    "EventNotificationProcessorFunction3DAD22BB": {
      "DependsOn": [
        "EventNotificationProcessorFunctionServiceRole25561C1E",
      ],
      "Properties": {
        "Code": {
          "S3Bucket": {
            "Fn::Sub": "cdk-hnb659fds-assets-\${AWS::AccountId}-\${AWS::Region}",
          },
          "S3Key": "dddef78016b089b0e596e5f0f869edcccf3e8c1d6c1ad3e9c18abd85bf384c93.zip",
        },
        "Environment": {
          "Variables": {
            "AWS_NODEJS_CONNECTION_REUSE_ENABLED": "1",
          },
        },
        "Handler": "index.handler",
        "Role": {
          "Fn::GetAtt": [
            "EventNotificationProcessorFunctionServiceRole25561C1E",
            "Arn",
          ],
        },
        "Runtime": "nodejs16.x",
      },
      "Type": "AWS::Lambda::Function",
    },
    "EventNotificationProcessorFunctionServiceRole25561C1E": {
      "Properties": {
        "AssumeRolePolicyDocument": {
          "Statement": [
            {
              "Action": "sts:AssumeRole",
              "Effect": "Allow",
              "Principal": {
                "Service": "lambda.amazonaws.com",
              },
            },
          ],
          "Version": "2012-10-17",
        },
        "ManagedPolicyArns": [
          {
            "Fn::Join": [
              "",
              [
                "arn:",
                {
                  "Ref": "AWS::Partition",
                },
                ":iam::aws:policy/service-role/AWSLambdaBasicExecutionRole",
              ],
            ],
          },
        ],
      },
      "Type": "AWS::IAM::Role",
    },
    "GetMetricWidgetImageFunctionCBFBB5EA": {
      "DependsOn": [
        "GetMetricWidgetImageFunctionServiceRoleDefaultPolicy1EAD855D",
        "GetMetricWidgetImageFunctionServiceRoleCA71188B",
      ],
      "Properties": {
        "Code": {
          "S3Bucket": {
            "Fn::Sub": "cdk-hnb659fds-assets-\${AWS::AccountId}-\${AWS::Region}",
          },
          "S3Key": "a4ca194222f0a68c191c751d6265c82550e4a277c35cf45e5002908761b4b725.zip",
        },
        "Environment": {
          "Variables": {
            "AWS_NODEJS_CONNECTION_REUSE_ENABLED": "1",
            "BUCKET_NAME": {
              "Ref": "MetricBucket8C17F29F",
            },
            "EVENT_NOTIFICATION_PROCESSOR_FUNCTION_NAME": {
              "Ref": "EventNotificationProcessorFunction3DAD22BB",
            },
          },
        },
        "Handler": "index.handler",
        "Role": {
          "Fn::GetAtt": [
            "GetMetricWidgetImageFunctionServiceRoleCA71188B",
            "Arn",
          ],
        },
        "Runtime": "nodejs16.x",
        "Timeout": 30,
      },
      "Type": "AWS::Lambda::Function",
    },
    "GetMetricWidgetImageFunctionServiceRoleCA71188B": {
      "Properties": {
        "AssumeRolePolicyDocument": {
          "Statement": [
            {
              "Action": "sts:AssumeRole",
              "Effect": "Allow",
              "Principal": {
                "Service": "lambda.amazonaws.com",
              },
            },
          ],
          "Version": "2012-10-17",
        },
        "ManagedPolicyArns": [
          {
            "Fn::Join": [
              "",
              [
                "arn:",
                {
                  "Ref": "AWS::Partition",
                },
                ":iam::aws:policy/service-role/AWSLambdaBasicExecutionRole",
              ],
            ],
          },
        ],
      },
      "Type": "AWS::IAM::Role",
    },
    "GetMetricWidgetImageFunctionServiceRoleDefaultPolicy1EAD855D": {
      "Properties": {
        "PolicyDocument": {
          "Statement": [
            {
              "Action": [
                "s3:PutObject",
                "s3:PutObjectLegalHold",
                "s3:PutObjectRetention",
                "s3:PutObjectTagging",
                "s3:PutObjectVersionTagging",
                "s3:Abort*",
              ],
              "Effect": "Allow",
              "Resource": {
                "Fn::Join": [
                  "",
                  [
                    {
                      "Fn::GetAtt": [
                        "MetricBucket8C17F29F",
                        "Arn",
                      ],
                    },
                    "/*",
                  ],
                ],
              },
            },
            {
              "Action": "cloudwatch:GetMetricWidgetImage",
              "Effect": "Allow",
              "Resource": "*",
            },
          ],
          "Version": "2012-10-17",
        },
        "PolicyName": "GetMetricWidgetImageFunctionServiceRoleDefaultPolicy1EAD855D",
        "Roles": [
          {
            "Ref": "GetMetricWidgetImageFunctionServiceRoleCA71188B",
          },
        ],
      },
      "Type": "AWS::IAM::Policy",
    },
    "GetMetricWidgetImageRule3D493BCC": {
      "Properties": {
        "ScheduleExpression": "rate(1 minute)",
        "State": "ENABLED",
        "Targets": [
          {
            "Arn": {
              "Fn::GetAtt": [
                "GetMetricWidgetImageFunctionCBFBB5EA",
                "Arn",
              ],
            },
            "Id": "Target0",
          },
        ],
      },
      "Type": "AWS::Events::Rule",
    },
    "GetMetricWidgetImageRuleAllowEventRuleS3LifecycleStackGetMetricWidgetImageFunction8728EEFFB9447EC0": {
      "Properties": {
        "Action": "lambda:InvokeFunction",
        "FunctionName": {
          "Fn::GetAtt": [
            "GetMetricWidgetImageFunctionCBFBB5EA",
            "Arn",
          ],
        },
        "Principal": "events.amazonaws.com",
        "SourceArn": {
          "Fn::GetAtt": [
            "GetMetricWidgetImageRule3D493BCC",
            "Arn",
          ],
        },
      },
      "Type": "AWS::Lambda::Permission",
    },
    "LifecycleBucket0668F9AE": {
      "DeletionPolicy": "Retain",
      "Properties": {
        "LifecycleConfiguration": {
          "Rules": [
            {
              "ExpirationInDays": 1,
              "Status": "Enabled",
            },
          ],
        },
      },
      "Type": "AWS::S3::Bucket",
      "UpdateReplacePolicy": "Retain",
    },
    "LifecycleBucketAllowBucketNotificationsToS3LifecycleStackEventNotificationProcessorFunction01C3F43F7DD41578": {
      "Properties": {
        "Action": "lambda:InvokeFunction",
        "FunctionName": {
          "Fn::GetAtt": [
            "EventNotificationProcessorFunction3DAD22BB",
            "Arn",
          ],
        },
        "Principal": "s3.amazonaws.com",
        "SourceAccount": {
          "Ref": "AWS::AccountId",
        },
        "SourceArn": {
          "Fn::GetAtt": [
            "LifecycleBucket0668F9AE",
            "Arn",
          ],
        },
      },
      "Type": "AWS::Lambda::Permission",
    },
    "LifecycleBucketNotifications414917F6": {
      "DependsOn": [
        "LifecycleBucketAllowBucketNotificationsToS3LifecycleStackEventNotificationProcessorFunction01C3F43F7DD41578",
        "LifecycleBucketPolicyC564CE4E",
      ],
      "Properties": {
        "BucketName": {
          "Ref": "LifecycleBucket0668F9AE",
        },
        "Managed": true,
        "NotificationConfiguration": {
          "LambdaFunctionConfigurations": [
            {
              "Events": [
                "s3:LifecycleExpiration:*",
              ],
              "LambdaFunctionArn": {
                "Fn::GetAtt": [
                  "EventNotificationProcessorFunction3DAD22BB",
                  "Arn",
                ],
              },
            },
          ],
        },
        "ServiceToken": {
          "Fn::GetAtt": [
            "BucketNotificationsHandler050a0587b7544547bf325f094a3db8347ECC3691",
            "Arn",
          ],
        },
        "SkipDestinationValidation": false,
      },
      "Type": "Custom::S3BucketNotifications",
    },
    "LifecycleBucketPolicyC564CE4E": {
      "Properties": {
        "Bucket": {
          "Ref": "LifecycleBucket0668F9AE",
        },
        "PolicyDocument": {
          "Statement": [
            {
              "Action": "s3:*",
              "Condition": {
                "Bool": {
                  "aws:SecureTransport": "false",
                },
              },
              "Effect": "Deny",
              "Principal": {
                "AWS": "*",
              },
              "Resource": [
                {
                  "Fn::GetAtt": [
                    "LifecycleBucket0668F9AE",
                    "Arn",
                  ],
                },
                {
                  "Fn::Join": [
                    "",
                    [
                      {
                        "Fn::GetAtt": [
                          "LifecycleBucket0668F9AE",
                          "Arn",
                        ],
                      },
                      "/*",
                    ],
                  ],
                },
              ],
            },
          ],
          "Version": "2012-10-17",
        },
      },
      "Type": "AWS::S3::BucketPolicy",
    },
    "MetricBucket8C17F29F": {
      "DeletionPolicy": "Retain",
      "Properties": {
        "PublicAccessBlockConfiguration": {
          "BlockPublicAcls": false,
          "BlockPublicPolicy": false,
          "IgnorePublicAcls": false,
          "RestrictPublicBuckets": false,
        },
      },
      "Type": "AWS::S3::Bucket",
      "UpdateReplacePolicy": "Retain",
    },
    "MetricBucketPolicy5485ABD1": {
      "Properties": {
        "Bucket": {
          "Ref": "MetricBucket8C17F29F",
        },
        "PolicyDocument": {
          "Statement": [
            {
              "Action": "s3:*",
              "Condition": {
                "Bool": {
                  "aws:SecureTransport": "false",
                },
              },
              "Effect": "Deny",
              "Principal": {
                "AWS": "*",
              },
              "Resource": [
                {
                  "Fn::GetAtt": [
                    "MetricBucket8C17F29F",
                    "Arn",
                  ],
                },
                {
                  "Fn::Join": [
                    "",
                    [
                      {
                        "Fn::GetAtt": [
                          "MetricBucket8C17F29F",
                          "Arn",
                        ],
                      },
                      "/*",
                    ],
                  ],
                },
              ],
            },
            {
              "Action": "s3:GetObject",
              "Effect": "Allow",
              "Principal": {
                "AWS": "*",
              },
              "Resource": {
                "Fn::Join": [
                  "",
                  [
                    {
                      "Fn::GetAtt": [
                        "MetricBucket8C17F29F",
                        "Arn",
                      ],
                    },
                    "/*",
                  ],
                ],
              },
            },
          ],
          "Version": "2012-10-17",
        },
      },
      "Type": "AWS::S3::BucketPolicy",
    },
    "ObjectPutterFunctionB7AF56BE": {
      "DependsOn": [
        "ObjectPutterFunctionServiceRoleDefaultPolicy591FA0C5",
        "ObjectPutterFunctionServiceRoleB24FBA64",
      ],
      "Properties": {
        "Code": {
          "S3Bucket": {
            "Fn::Sub": "cdk-hnb659fds-assets-\${AWS::AccountId}-\${AWS::Region}",
          },
          "S3Key": "02d9ac87dbd1d7c6ca63fb3bf17850223a822848d315be462882e21d5c0ac759.zip",
        },
        "Environment": {
          "Variables": {
            "AWS_NODEJS_CONNECTION_REUSE_ENABLED": "1",
            "BUCKET_NAME": {
              "Ref": "LifecycleBucket0668F9AE",
            },
          },
        },
        "Handler": "index.handler",
        "Role": {
          "Fn::GetAtt": [
            "ObjectPutterFunctionServiceRoleB24FBA64",
            "Arn",
          ],
        },
        "Runtime": "nodejs16.x",
      },
      "Type": "AWS::Lambda::Function",
    },
    "ObjectPutterFunctionServiceRoleB24FBA64": {
      "Properties": {
        "AssumeRolePolicyDocument": {
          "Statement": [
            {
              "Action": "sts:AssumeRole",
              "Effect": "Allow",
              "Principal": {
                "Service": "lambda.amazonaws.com",
              },
            },
          ],
          "Version": "2012-10-17",
        },
        "ManagedPolicyArns": [
          {
            "Fn::Join": [
              "",
              [
                "arn:",
                {
                  "Ref": "AWS::Partition",
                },
                ":iam::aws:policy/service-role/AWSLambdaBasicExecutionRole",
              ],
            ],
          },
        ],
      },
      "Type": "AWS::IAM::Role",
    },
    "ObjectPutterFunctionServiceRoleDefaultPolicy591FA0C5": {
      "Properties": {
        "PolicyDocument": {
          "Statement": [
            {
              "Action": [
                "s3:DeleteObject*",
                "s3:PutObject",
                "s3:PutObjectLegalHold",
                "s3:PutObjectRetention",
                "s3:PutObjectTagging",
                "s3:PutObjectVersionTagging",
                "s3:Abort*",
              ],
              "Effect": "Allow",
              "Resource": [
                {
                  "Fn::GetAtt": [
                    "LifecycleBucket0668F9AE",
                    "Arn",
                  ],
                },
                {
                  "Fn::Join": [
                    "",
                    [
                      {
                        "Fn::GetAtt": [
                          "LifecycleBucket0668F9AE",
                          "Arn",
                        ],
                      },
                      "/*",
                    ],
                  ],
                },
              ],
            },
          ],
          "Version": "2012-10-17",
        },
        "PolicyName": "ObjectPutterFunctionServiceRoleDefaultPolicy591FA0C5",
        "Roles": [
          {
            "Ref": "ObjectPutterFunctionServiceRoleB24FBA64",
          },
        ],
      },
      "Type": "AWS::IAM::Policy",
    },
    "PutObjectRule14B72DB4": {
      "Properties": {
        "ScheduleExpression": "rate(1 minute)",
        "State": "ENABLED",
        "Targets": [
          {
            "Arn": {
              "Fn::GetAtt": [
                "ObjectPutterFunctionB7AF56BE",
                "Arn",
              ],
            },
            "Id": "Target0",
          },
        ],
      },
      "Type": "AWS::Events::Rule",
    },
    "PutObjectRuleAllowEventRuleS3LifecycleStackObjectPutterFunctionCEB99F90A09AF9A4": {
      "Properties": {
        "Action": "lambda:InvokeFunction",
        "FunctionName": {
          "Fn::GetAtt": [
            "ObjectPutterFunctionB7AF56BE",
            "Arn",
          ],
        },
        "Principal": "events.amazonaws.com",
        "SourceArn": {
          "Fn::GetAtt": [
            "PutObjectRule14B72DB4",
            "Arn",
          ],
        },
      },
      "Type": "AWS::Lambda::Permission",
    },
  },
  "Rules": {
    "CheckBootstrapVersion": {
      "Assertions": [
        {
          "Assert": {
            "Fn::Not": [
              {
                "Fn::Contains": [
                  [
                    "1",
                    "2",
                    "3",
                    "4",
                    "5",
                  ],
                  {
                    "Ref": "BootstrapVersion",
                  },
                ],
              },
            ],
          },
          "AssertDescription": "CDK bootstrap stack version 6 required. Please run 'cdk bootstrap' with a recent version of the CDK CLI.",
        },
      ],
    },
  },
}
`);
  })
});