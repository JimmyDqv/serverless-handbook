# AI Bartender Datastore

This directory contains the AWS datastore infrastructure for the AI Bartender application, including the Aurora DSQL cluster, IAM roles, S3 bucket for images, and CloudFront distribution.

## Overview

The datastore stack creates:

- **Aurora DSQL Cluster**: PostgreSQL-compatible serverless database
- **IAM Roles**: Separate reader and writer roles for Lambda functions
- **S3 Bucket**: Storage for drink images with public read access
- **CloudFront Distribution**: CDN for fast image delivery

## Deployment

### Prerequisites

1. **AWS CLI** configured with appropriate permissions
2. **SAM CLI** installed
3. **AWS Account** with permissions to create DSQL clusters, IAM roles, S3 buckets, and CloudFront distributions

### Deploy Commands

```bash
# Build the template
sam build

# Deploy to development
sam deploy --config-env default

# Deploy to staging
sam deploy --config-env staging

# Deploy to production
sam deploy --config-env prod
```

### Manual Deploy (without samconfig)

```bash
sam deploy \
  --stack-name ai-bartender-datastore-dev \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides Application=ai-bartender Environment=dev
```

## Outputs

After deployment, the stack provides these outputs:

| Output | Description | Export Name |
|--------|-------------|-------------|
| DSQLClusterEndpoint | DSQL cluster connection endpoint | `{StackName}:dsql-cluster-endpoint` |
| DataWriterRoleArn | IAM role ARN for write operations | `{StackName}:dsql-data-writer-role-arn` |
| DataReaderRoleArn | IAM role ARN for read operations | `{StackName}:dsql-data-reader-role-arn` |
| DrinkImagesBucketName | S3 bucket name for images | `{StackName}:drink-images-bucket-name` |
| CloudFrontDistributionDomainName | CDN domain for images | `{StackName}:cloudfront-domain-name` |

## Database Schema

After deploying the datastore, apply the database schema:

```bash
cd ../../../database/schema-manager
python schema_manager.py --action upgrade
```

## IAM Roles

### Data Writer Role
- **Purpose**: Lambda functions that create/update/delete data
- **Permissions**: Full DSQL access
- **Used by**: Order creation, drink management, admin APIs

### Data Reader Role
- **Purpose**: Lambda functions that only read data
- **Permissions**: DSQL read access only
- **Used by**: Public APIs, drink browsing, order status

## Next Steps

After successful datastore deployment:

1. **Apply Database Schema**: Run schema migrations
2. **Deploy API Stack**: Deploy Lambda functions and API Gateway
3. **Test Integration**: Verify all components work together