# Hosting Infrastructure

This stack creates the hosting infrastructure for the AI Bartender application, including:

- **Frontend S3 Bucket**: Stores the React application static files
- **Images S3 Bucket**: Stores drink images with proper lifecycle policies
- **Single CloudFront Distribution**: Serves both frontend and images with different cache behaviors
- **Custom Domain**: Custom domain with SSL certificate
- **Route53 DNS**: Points custom domain to CloudFront
- **IAM Roles**: For image uploads and frontend deployment

## Architecture

```
your-domain.com
       ↓
   CloudFront CDN
       ↓
   ┌─────────────────┐
   │  Path Routing   │
   └─────────────────┘
       ↓         ↓
   Frontend    Images
   S3 Bucket   S3 Bucket
   (React App) (Drink Images)
```

## Path Routing

- **`/`** → Frontend S3 Bucket (React SPA)
- **`/images/*`** → Images S3 Bucket (Drink images)

## Deployment

```bash
# Deploy hosting infrastructure
cd aws/infrastructure/hosting
sam build && sam deploy --config-env default
```

## Frontend Deployment

After the infrastructure is deployed, deploy the React app:

```bash
# Build React app
npm run build

# Sync to S3 bucket
aws s3 sync dist/ s3://ai-bartender-frontend-{account-id} --delete

# Invalidate CloudFront cache
aws cloudfront create-invalidation --distribution-id {distribution-id} --paths "/*"
```

## Image Storage

Images are stored in the images bucket with the following structure:

```
ai-bartender-images-{account-id}/
├── original/
│   └── {drink-id}/
│       └── {filename}.png          ← uploaded by admin
└── images/
    └── optimized/
        ├── thumbnail/{drink-id}.webp   (150×150)
        ├── small/{drink-id}.webp       (400×400)
        ├── medium/{drink-id}.webp      (800×800)
        └── large/{drink-id}.webp       (1200×1200)
```

The `image-processing` service watches for uploads to `original/` via EventBridge and automatically generates all optimized sizes as WebP.

Images are served via CloudFront at:
- `https://your-domain.com/images/optimized/thumbnail/{drink-id}.webp`
- `https://your-domain.com/images/optimized/small/{drink-id}.webp`
- `https://your-domain.com/images/optimized/medium/{drink-id}.webp`
- `https://your-domain.com/images/optimized/large/{drink-id}.webp`

## Security

- Both S3 buckets are private (no public access)
- CloudFront uses Origin Access Control (OAC) for secure S3 access
- SSL/TLS certificate for HTTPS
- Proper CORS configuration for frontend domain only