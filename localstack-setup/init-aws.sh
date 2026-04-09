#!/bin/bash

# Force LocalStack to use us-west-2
export AWS_DEFAULT_REGION="us-west-2"
RDS_USERNAME="root"
RDS_PASSWORD="d0ckerSecr3t"
EZID_SHOULDER="11.22222/A1"

# Create the DynamoDB table to store maDMP records
echo "Creating DynamoDB table: localDMPTable..."
awslocal dynamodb create-table \
    --table-name localDMPTable \
    --attribute-definitions \
        AttributeName=PK,AttributeType=S \
        AttributeName=SK,AttributeType=S \
    --key-schema \
        AttributeName=PK,KeyType=HASH \
        AttributeName=SK,KeyType=RANGE \
    --billing-mode PAY_PER_REQUEST \
    --stream-specification StreamEnabled=true,StreamViewType=NEW_IMAGE

# Setup the SSM parameters for the lambda function
echo 'Creating SSM parameters ...'
awslocal ssm put-parameter --name "/uc3/dmp/tool/dev/RdsUsername" --value "${RDS_USERNAME}" --type "String" --overwrite
awslocal ssm put-parameter --name "/uc3/dmp/tool/dev/RdsPassword" --value "${RDS_PASSWORD}" --type "String" --overwrite
awslocal ssm put-parameter --name "/uc3/dmp/tool/dev/EzidShoulder" --value "${EZID_SHOULDER}" --type "String" --overwrite
