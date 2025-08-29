# Railway Deployment Guide for ClipFlow

## Quick Deploy to Railway

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/ClipFlow)

## Prerequisites

1. **MongoDB Database**: Set up a MongoDB database (Railway provides MongoDB templates)
2. **AWS S3 Bucket**: For file storage (recommended for production)
3. **Email Service**: SMTP configuration for email functionality
4. **OpenAI API Key**: For AI-powered features

## Environment Variables

Configure these environment variables in your Railway project:

### Required Environment Variables

```bash
# Database Configuration
MONGODB_URI=mongodb://username:password@host:port/database
# Example: mongodb+srv://user:pass@cluster.mongodb.net/clipflow

# Application Configuration
PORT=3000  # Railway will set this automatically
NODE_ENV=production

# JWT Configuration
JWT_SECRET=your-super-secure-jwt-secret-key-for-production
ACCESS_TOKEN_EXPIRE_MINUTES=525600  # 1 year
RESET_TOKEN_EXPIRE_MINUTES=15

# AWS S3 Configuration (Recommended for Production)
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_REGION=us-east-1
AWS_S3_BUCKET=your-s3-bucket-name

# Email Configuration
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
EMAIL_FROM=noreply@yourapp.com
FRONTEND_URL=https://your-app.railway.app

# OpenAI Configuration
OPENAI_API_KEY=sk-your-openai-api-key

# File Upload Configuration
UPLOAD_PATH=/tmp/uploads  # Railway uses ephemeral storage
MAX_FILE_SIZE=104857600   # 100MB in bytes
```

### Optional Environment Variables

```bash
# Google Drive Configuration (Alternative to S3)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=https://your-app.railway.app/auth/google/callback

# FFmpeg Configuration (automatically available on Railway)
FFMPEG_PATH=/usr/bin/ffmpeg    # Usually not needed
FFPROBE_PATH=/usr/bin/ffprobe  # Usually not needed

# Advanced Configuration
CORS_ORIGIN=https://your-frontend.com
LOG_LEVEL=info
```

## Railway Setup Steps

### 1. Deploy to Railway

1. **From GitHub**:
   - Connect your GitHub repository to Railway
   - Railway will automatically detect the Node.js project
   - The build will use the configuration files we've provided

2. **From Template** (if available):
   - Click the "Deploy on Railway" button above
   - Configure your environment variables

### 2. Add MongoDB Database

```bash
# Option 1: Use Railway's MongoDB template
# Go to Railway dashboard > New > Database > MongoDB

# Option 2: Use external MongoDB (like MongoDB Atlas)
# Set MONGODB_URI to your external connection string
```

### 3. Configure Environment Variables

In your Railway project dashboard:
1. Go to the "Variables" tab
2. Add all required environment variables listed above
3. **Important**: Never commit real secrets to your repository

### 4. Set up AWS S3 (Recommended)

For production file storage:
1. Create an S3 bucket in AWS
2. Set up IAM user with S3 permissions
3. Add AWS credentials to Railway environment variables

Example S3 IAM policy:
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
                "s3:ListBucket"
            ],
            "Resource": [
                "arn:aws:s3:::your-bucket-name",
                "arn:aws:s3:::your-bucket-name/*"
            ]
        }
    ]
}
```

## File Storage Configuration

### Production Storage Strategy

Railway uses ephemeral storage, so uploaded files should be stored externally:

1. **AWS S3** (Recommended):
   - Persistent storage
   - CDN capabilities
   - Automatic scaling

2. **Google Drive**:
   - Alternative option
   - Good for document storage

3. **Local Storage**:
   - Only for temporary files
   - Files are lost on deployment restarts

### Upload Directory Configuration

The app creates these directories automatically:
- `/tmp/uploads/videos/` - Temporary video files
- `/tmp/uploads/clips/` - Processed clips
- `/tmp/uploads/srt/` - Subtitle files
- `/tmp/uploads/temp/` - Temporary processing files

## API Documentation

Once deployed, your API documentation will be available at:
- **Swagger UI**: `https://your-app.railway.app/api`
- **Health Check**: `https://your-app.railway.app/`

## Monitoring and Logs

Railway provides built-in monitoring:
1. **Application Logs**: View in Railway dashboard
2. **Metrics**: CPU, Memory, Network usage
3. **Health Checks**: Automatic endpoint monitoring

## Security Considerations

1. **JWT Secret**: Use a strong, unique secret for production
2. **CORS**: Configure appropriate CORS origins
3. **Rate Limiting**: Consider implementing rate limiting
4. **HTTPS**: Railway provides HTTPS automatically
5. **Environment Variables**: Never commit secrets to version control

## Troubleshooting

### Common Issues

1. **Build Failures**:
   - Ensure Node.js version compatibility
   - Check for missing dependencies

2. **FFmpeg Not Found**:
   - FFmpeg is included in nixpacks.toml
   - Verify FFMPEG_PATH if needed

3. **File Upload Issues**:
   - Check AWS S3 credentials
   - Verify bucket permissions
   - Ensure UPLOAD_PATH is writable

4. **Database Connection**:
   - Verify MONGODB_URI format
   - Check database accessibility
   - Ensure IP whitelist includes Railway IPs

### Health Check Endpoint

The application includes a health check at `/` that returns:
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "version": "1.0.0"
}
```

## Scaling

Railway automatically handles:
- **Horizontal Scaling**: Multiple instances
- **Vertical Scaling**: CPU/Memory adjustments
- **Load Balancing**: Automatic traffic distribution

## Cost Optimization

1. **Starter Plan**: Good for development/testing
2. **Pro Plan**: Recommended for production
3. **Database**: Consider external MongoDB for cost efficiency
4. **File Storage**: Use S3 for large file storage

## Support

- **Railway Documentation**: [railway.app/docs](https://railway.app/docs)
- **Railway Discord**: Community support
- **GitHub Issues**: For application-specific issues
