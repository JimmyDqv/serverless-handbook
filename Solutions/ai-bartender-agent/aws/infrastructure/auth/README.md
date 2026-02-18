# AI Bartender Authentication Stack

This stack provides simple JWT-based authentication for the AI Bartender application using AWS Cognito User Pool.

## Components

### AWS Cognito User Pool
- Manages user authentication for bartenders/admins
- Email-based authentication with secure password policies
- Admin-only user creation (no self-registration)
- Simple JWT token validation (no Identity Pool complexity)

### Admin User Group
- Special group for bartender users with admin permissions
- Used by Lambda authorizer to validate admin access

## Deployment

**IMPORTANT: Deploy manually - no automated deployment scripts**

Deploy this stack before the API stack:

```bash
# Build and deploy manually
cd aws/infrastructure/auth
sam build
sam deploy --config-env default
```

## Outputs

The stack exports the following values for use by other stacks:
- `UserPoolId`: Cognito User Pool identifier
- `UserPoolClientId`: Client application identifier  
- `UserPoolArn`: User Pool ARN for Lambda authorizers

## User Management

### Creating Admin Users

After deployment, create admin users through AWS CLI:

```bash
# Get the User Pool ID from stack outputs
USER_POOL_ID=$(aws cloudformation describe-stacks --stack-name ai-bartender-auth --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' --output text)

# Create a new admin user
aws cognito-idp admin-create-user \
  --user-pool-id $USER_POOL_ID \
  --username bartender@example.com \
  --user-attributes Name=email,Value=bartender@example.com \
  --temporary-password TempPass123!

# Add user to admin group
aws cognito-idp admin-add-user-to-group \
  --user-pool-id $USER_POOL_ID \
  --username bartender@example.com \
  --group-name admin
```

### Password Policy

- Minimum 8 characters
- Must contain uppercase and lowercase letters
- Must contain numbers
- Symbols are optional

## Integration

- **API Stack**: Simple JWT validation for admin endpoints
- **Frontend**: Direct Cognito integration (no Amplify complexity)
- **Public Endpoints**: No authentication required

## Security Features

- Simple JWT token validation
- Admin group membership checking
- Email verification required
- Secure password policies