# AI Bartender - AWS Infrastructure

All AWS SAM stacks for the AI Bartender application.

## Structure

```
aws/
├── infrastructure/                 # Foundational resources
│   ├── datastore/                  # Aurora DSQL cluster + IAM roles
│   ├── auth/                       # Cognito User Pool + clients
│   ├── hosting/                    # S3 + CloudFront
│   ├── hosting-ssl/                # ACM certificate (us-east-1)
│   ├── eventbridge/                # EventBridge event bus
│   └── appsync/                    # AppSync real-time events
└── services/                       # Application stacks
    ├── api/                        # REST API (28 Lambda functions)
    ├── chat-api/                   # Streaming + sync chat endpoints
    ├── agentcore/                  # AgentCore Gateway + Memory + MCP Tools
    ├── image-generation/           # Bedrock image prompt generation
    └── image-processing/           # Image optimization pipeline
```

## Stack Dependencies

Stacks must be deployed in order due to cross-stack references:

```
infrastructure/hosting-ssl  →  infrastructure/hosting
infrastructure/datastore    →  api, image-processing
infrastructure/datastore    →  agentcore  →  chat-api
infrastructure/hosting      →  image-processing
infrastructure/auth         →  api
infrastructure/eventbridge  →  api, image-generation
infrastructure/appsync      →  api
```

## Deployment Order

Each stack is built and deployed independently with SAM:

```bash
# 1. SSL Certificate (must be us-east-1 for CloudFront)
cd aws/infrastructure/hosting-ssl
sam build && sam deploy

# 2. Datastore (Aurora DSQL)
cd ../datastore
sam build && sam deploy

# 3. Database schema (see database/README.md)
cd ../../../database/schema-manager
python schema_manager.py --action upgrade

# 4. Authentication
cd ../../aws/infrastructure/auth
sam build && sam deploy

# 5. EventBridge
cd ../eventbridge
sam build && sam deploy

# 6. AppSync Events
cd ../appsync
sam build && sam deploy

# 7. Hosting (S3 + CloudFront)
cd ../hosting
sam build && sam deploy

# 8. REST API
cd ../../services/api
sam build && sam deploy

# 9. JWT Keys (one-time, after API stack creates the secret)
python3 setup-jwt-keys.py --profile <your-profile>

# 10. AgentCore
cd ../agentcore
sam build && sam deploy

# 11. Chat API
cd ../chat-api
sam build && sam deploy

# 12. Image Generation
cd ../image-generation
sam build && sam deploy

# 13. Image Processing
cd ../image-processing
sam build && sam deploy
```

## Infrastructure Stacks

| Stack | Purpose |
| ----- | ------- |
| `datastore` | Aurora DSQL cluster, IAM reader/writer roles |
| `auth` | Cognito User Pool, clients, admin group, managed login |
| `hosting` | S3 buckets (frontend + images), CloudFront CDN |
| `hosting-ssl` | ACM certificate for CloudFront (deployed in us-east-1) |
| `eventbridge` | Custom event bus for async workflows (drink created, order events) |
| `appsync` | AppSync Events API for real-time order update subscriptions |

## Application Stacks

| Stack | Purpose |
| ----- | ------- |
| `api` | REST API Gateway with 28 Lambda functions (drinks CRUD, orders, auth, admin, registration) |
| `chat-api` | Streaming chat (Lambda Web Adapter + FastAPI) and sync chat fallback |
| `agentcore` | AgentCore Gateway (MCP), Memory (conversation + preferences), MCP Tools Lambda |
| `image-generation` | EventBridge-triggered Lambda for Bedrock image prompt generation |
| `image-processing` | Image optimization pipeline (resize, WebP conversion, database update) |

## Configuration

Each stack uses `samconfig.yaml` for deployment parameters. Cross-stack references use CloudFormation exports (`Fn::ImportValue`).

## Architecture Decisions

### Lambda Target vs OpenAPI Target for AgentCore Gateway

CloudFormation doesn't support `ApiKeyCredentialProvider` for OpenAPI targets. Instead, we use a dedicated Lambda with `GATEWAY_IAM_ROLE` authentication - a 100% IaC-native solution that also provides better separation of concerns between MCP tools and the client-facing REST API.

### Python Streaming with Lambda Web Adapter

Lambda response streaming is natively only supported on Node.js. We use the [AWS Lambda Web Adapter](https://github.com/awslabs/aws-lambda-web-adapter) layer to enable streaming for Python/FastAPI applications.

### Multi-Region SSL Setup

CloudFront SSL certificates must be in `us-east-1`, but the application runs in `eu-west-1`. The `infrastructure/hosting-ssl/` stack is deployed separately to handle this AWS constraint.

### Nova 2 vs Nova v1 for Tool Use

Nova v1 models produce "invalid sequence as part of ToolUse" errors with MCP tools. Nova 2 Lite provides reliable tool use handling and is cost-effective for conversational AI.

## Security

- IAM-based DSQL authentication (no stored passwords)
- Separate reader/writer IAM roles (least privilege)
- HTTPS-only via CloudFront + ACM
- API Gateway with CORS, rate limiting, and API keys
- Cognito JWT validation for admin endpoints
- AgentCore Gateway with IAM authentication
