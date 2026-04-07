# Solution - Serverless Event Platform

![cover](images/cover-image.png)

Complete serverless event management platform with guest RSVP, admin dashboard, PDP/PEP authentication, and async activity tracking. Built with AWS Lambda, API Gateway, MongoDB Atlas, SQS, S3, and CloudFront.

For a detailed walkthrough of the architecture and design decisions, see the [blog post](https://jimmydqv.com/serverless-event-platform/).

## Cost

This is a 100% serverless solution using only pay-per-use AWS services. The MongoDB Atlas cluster is the only fixed-cost component (M10+ required for workload federation).

## Key Patterns

- **PDP/PEP Authentication** — Separate Policy Decision Point (auth service that issues JWT) and Policy Enforcement Points (API Gateway Lambda authorizers that validate tokens). Uses RS256 asymmetric signing.
- **Outbound Identity Federation** — Lambda authenticates to MongoDB Atlas using OIDC tokens via `sts:GetWebIdentityToken`. No database credentials stored anywhere. See the [federation blog post](https://jimmydqv.com/m2m-outbound-federation-mongodb/) for details.
- **Role-Based Access Control** — Dual authorizers: Admin endpoints require `isAdmin: true` in the JWT, Guest endpoints accept any valid token.
- **Group Relationships** — Guests are connected via a shared `groupId` field, supporting couples, families, and friend groups. One update to add or remove a member.
- **Aggregation Pipelines** — Admin dashboard stats (invited, coming, allergies) are computed server-side via MongoDB aggregation, not client-side filtering.
- **Async Activity Tracking** — Login and access events are dispatched to SQS and processed asynchronously by a Lambda consumer.
- **Multi-Stack Deployment** — Four independent SAM stacks with cross-stack references via CloudFormation exports.

## Architecture

The solution is deployed as 4 independent SAM stacks + MongoDB Atlas:

1. **Auth / PDP** (`aws/infrastructure/auth/`) — Lambda function that validates credentials against MongoDB and issues RS256 JWT tokens
2. **API / PEP** (`aws/services/api/`) — HTTP API Gateway with dual Lambda authorizers (admin + guest), RSVP endpoints, admin CRUD, group management, SQS tracking queue, and custom domain
3. **Hosting Certificate** (`aws/infrastructure/hosting-cert/`) — ACM certificate in us-east-1 for CloudFront
4. **Hosting** (`aws/infrastructure/hosting/`) — S3 bucket with CloudFront distribution, custom domain DNS records

**Database:** MongoDB Atlas cluster with two collections (`guests`, `settings`) and four indexes.

### Frontend

React 19 SPA built with Vite, styled with Tailwind CSS 4 and Framer Motion animations. All event content is driven from a single config file (`frontend/src/config/event.ts`).

## Prerequisites

- [AWS SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html)
- Python 3.13
- Node.js 18+ and npm
- AWS CLI configured with appropriate credentials
- A registered domain with a Route53 hosted zone
- MongoDB Atlas cluster (M10+ tier, MongoDB 7.0.11+)

## MongoDB Atlas Setup

### 1. Create Cluster

Create an M10+ cluster in MongoDB Atlas. Note the connection string (e.g., `mongodb+srv://cluster0.xxxxx.mongodb.net`).

### 2. Configure Outbound Identity Federation

Follow the [Outbound Identity Federation guide](https://jimmydqv.com/m2m-outbound-federation-mongodb/) to set up OIDC authentication:

1. In Atlas: **Federation → Identity Providers → Add Workload Identity Provider**
2. Set the **Issuer URL** to the AWS STS issuer from your IAM console
3. Set an **Audience** value (you'll use this as the `OIDC_AUDIENCE` parameter)
4. Link the identity provider to your Atlas organization
5. After deploying the auth stack, create a **database user** with federated auth — set the username to the Lambda's IAM Role ARN (from the stack output `LoginFunctionRoleArn`)

### 3. Set Up Database

```bash
cd database
pip install -r requirements.txt
python setup.py --uri "mongodb+srv://YOUR_USER:YOUR_PASS@cluster.mongodb.net" --db "event-platform"
```

This creates the `guests` and `settings` collections with the required indexes.

Optionally seed test data:

```bash
python seed_data.py --uri "mongodb+srv://YOUR_USER:YOUR_PASS@cluster.mongodb.net" --db "event-platform"
```

## Configuration

Update the `samconfig.yaml` files with your values:

| Placeholder | Description | Files |
|------------|-------------|-------|
| `YOUR_MONGODB_URI` | Atlas connection string (e.g., `mongodb+srv://cluster.mongodb.net`) | auth, api |
| `YOUR_OIDC_AUDIENCE` | Audience value from Atlas Identity Provider | auth, api |
| `YOUR_DOMAIN` | Your registered domain (e.g., `myevent.com`) | api, hosting, hosting-cert |
| `YOUR_HOSTED_ZONE_ID` | Route53 hosted zone ID for your domain | api, hosting, hosting-cert |
| `YOUR_CERTIFICATE_ARN` | ACM certificate ARN from the hosting-cert stack output | hosting |

Customize the event by editing `frontend/src/config/event.ts` — event name, date, location, schedule, and all UI text are controlled from this single file.

## Deployment

### 1. Generate JWT Keys

```bash
cd aws/infrastructure/auth
pip install cryptography
python generate_jwt_keys.py
```

Save the output — you'll paste it into Secrets Manager after deploying the auth stack.

### 2. Deploy Auth Stack

```bash
sam deploy --config-env default --template-file aws/infrastructure/auth/template.yaml
```

After deployment:

- Update the Secrets Manager secret with the JWT keys:

```bash
aws secretsmanager put-secret-value \
  --secret-id event-platform-auth/jwt-keys \
  --secret-string '<output from generate_jwt_keys.py>'
```

- Note the `LoginFunctionRoleArn` from the stack output — use this as the database username in Atlas OIDC user mapping.

### 3. Deploy API

```bash
sam deploy --config-env default --template-file aws/services/api/template.yaml
```

Note: After deployment, you'll also need to create Atlas database users for each Lambda role that accesses MongoDB (the API stack creates multiple roles). The role ARNs can be found in the CloudFormation console under the stack's resources.

### 4. Deploy Hosting

```bash
sam deploy --config-env default --template-file aws/infrastructure/hosting-cert/template.yaml
sam deploy --config-env default --template-file aws/infrastructure/hosting/template.yaml
```

### 5. Build & Deploy Frontend

```bash
cd frontend
npm install
echo "VITE_API_URL=https://api.YOUR_DOMAIN" > .env
npm run build
aws s3 sync dist/ s3://BUCKET_NAME --delete
aws cloudfront create-invalidation --distribution-id DISTRIBUTION_ID --paths "/*"
```

Get the bucket name and distribution ID from the hosting stack outputs.

## Cleanup

Delete stacks in reverse deployment order:

```bash
sam delete --stack-name event-platform-hosting
sam delete --stack-name event-platform-hosting-cert
sam delete --stack-name event-platform-api
sam delete --stack-name event-platform-auth
```

Delete the MongoDB Atlas cluster separately from the Atlas console.

## Deep Dive

- [Building a Party Registration Page with Serverless and MongoDB](https://jimmydqv.com/serverless-event-platform/) — Full blog post about this solution
- [M2M Outbound Identity Federation with MongoDB](https://jimmydqv.com/m2m-outbound-federation-mongodb/) — How the OIDC federation works
- [PDP and PEP in AWS](https://jimmydqv.com/pdp-and-pep-in-aws/) — The authorization pattern explained
