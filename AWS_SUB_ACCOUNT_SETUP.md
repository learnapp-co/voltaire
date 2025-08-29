# AWS Sub-Account S3 Setup Guide

This guide explains how to configure ClipFlow to work with S3 buckets in AWS sub-accounts (AWS Organizations).

## Architecture Overview

```
Root AWS Account
├── IAM User/Role (ClipFlow App Credentials)
└── Sub-Account (via AWS Organizations)
    ├── IAM Role (CrossAccountS3Role)
    └── S3 Bucket (your-video-bucket)
```

## Step 1: Create IAM Role in Sub-Account

In your **sub-account**, create an IAM role that trusts your root account:

### Role Name: `CrossAccountS3Role`

### Trust Policy:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::ROOT_ACCOUNT_ID:root"
      },
      "Action": "sts:AssumeRole",
      "Condition": {
        "StringEquals": {
          "sts:ExternalId": "clipflow-access"
        }
      }
    }
  ]
}
```

### Permission Policy:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:CreateMultipartUpload",
        "s3:CompleteMultipartUpload",
        "s3:AbortMultipartUpload",
        "s3:UploadPart",
        "s3:ListMultipartUploadParts"
      ],
      "Resource": [
        "arn:aws:s3:::your-video-bucket/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::your-video-bucket"
      ]
    }
  ]
}
```

## Step 2: Configure Root Account User/Role

In your **root account**, ensure your IAM user/role has permission to assume the sub-account role:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "sts:AssumeRole",
      "Resource": "arn:aws:iam::SUB_ACCOUNT_ID:role/CrossAccountS3Role"
    }
  ]
}
```

## Step 3: Environment Configuration

Add these environment variables to your `.env` file:

```bash
# Root account credentials (existing)
AWS_ACCESS_KEY_ID=your_root_access_key
AWS_SECRET_ACCESS_KEY=your_root_secret_key
AWS_REGION=us-east-1

# Sub-account configuration (new)
AWS_SUB_ACCOUNT_ROLE_ARN=arn:aws:iam::SUB_ACCOUNT_ID:role/CrossAccountS3Role
AWS_S3_BUCKET=your-video-bucket
```

## Step 4: S3 Bucket Configuration

In your **sub-account**, configure the S3 bucket:

### Bucket Policy (Optional - for additional security):
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::SUB_ACCOUNT_ID:role/CrossAccountS3Role"
      },
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:CreateMultipartUpload",
        "s3:CompleteMultipartUpload",
        "s3:AbortMultipartUpload",
        "s3:UploadPart",
        "s3:ListMultipartUploadParts"
      ],
      "Resource": [
        "arn:aws:s3:::your-video-bucket/*"
      ]
    }
  ]
}
```

### CORS Configuration (for web uploads):
```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
    "AllowedOrigins": ["*"],
    "ExposeHeaders": ["ETag"]
  }
]
```

## Step 5: Testing the Configuration

1. **Start your ClipFlow API**:
   ```bash
   npm run start:dev
   ```

2. **Check the logs** for successful role assumption:
   ```
   [S3UploadService] Using sub-account role: arn:aws:iam::SUB_ACCOUNT_ID:role/CrossAccountS3Role
   [S3UploadService] Successfully assumed role: arn:aws:iam::SUB_ACCOUNT_ID:role/CrossAccountS3Role
   [S3UploadService] S3 client initialized successfully
   ```

3. **Test signed URL generation**:
   ```bash
   curl -X POST http://localhost:3000/clips/upload/signed-url \
     -H "Content-Type: application/json" \
     -d '{"fileName": "test.mp4", "fileType": "video/mp4", "fileSize": 1000000}'
   ```

## How It Works

1. **App starts** → Uses root account credentials to create STS client
2. **AssumeRole** → STS client assumes role in sub-account
3. **Temporary credentials** → Receives temporary access keys with session token
4. **S3 operations** → Uses temporary credentials for all S3 operations
5. **Auto-refresh** → Credentials automatically refresh before expiration

## Security Benefits

✅ **Principle of Least Privilege**: Sub-account role has minimal S3 permissions  
✅ **Temporary Credentials**: Credentials expire after 1 hour  
✅ **Cross-Account Isolation**: Sub-account resources are isolated  
✅ **Audit Trail**: All operations logged in both accounts  
✅ **External ID**: Additional security layer in trust policy  

## Troubleshooting

### Error: "User is not authorized to perform: sts:AssumeRole"
- Check that root account user/role has permission to assume the sub-account role
- Verify the role ARN in environment variables

### Error: "Failed to assume sub-account role"
- Check the trust policy in the sub-account role
- Verify the root account ID in the trust policy
- Ensure the role exists in the sub-account

### Error: "Access Denied" on S3 operations
- Check the sub-account role's S3 permissions
- Verify the bucket name in environment variables
- Check S3 bucket policy (if configured)

## Alternative: Direct Sub-Account Credentials

If you prefer not to use AssumeRole, you can create IAM credentials directly in the sub-account:

```bash
# Use sub-account credentials directly (without AssumeRole)
AWS_ACCESS_KEY_ID=sub_account_access_key
AWS_SECRET_ACCESS_KEY=sub_account_secret_key
AWS_REGION=us-east-1
AWS_S3_BUCKET=your-video-bucket
# AWS_SUB_ACCOUNT_ROLE_ARN=  # Leave this empty or unset
```

This approach is simpler but provides less security and audit capabilities.
