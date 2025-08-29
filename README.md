# ClipFlow - Video Clip Management API with Chunked S3 Upload

A clean, simple video clip management API with chunked S3 upload support. No authentication, no Google Drive - just efficient chunked uploads and clip generation.

## Features

✅ **Simple & Clean**: Only 10 essential endpoints  
✅ **No Authentication**: Public API, no user management  
✅ **Chunked S3 Upload**: Multipart upload for large video files (up to 5GB)  
✅ **Single S3 Upload**: Simple upload for smaller files (up to 2GB)  
✅ **Direct Video URLs**: Support for AWS S3 and direct video file URLs  
✅ **SRT Subtitles**: Upload SRT files for timestamp generation  
✅ **Clip Generation**: Generate video clips from custom timestamps  

## Upload Options

### Small Files (< 2GB)
1. **Generate Signed URL**: Single upload URL for immediate upload
2. **Upload to S3**: Direct upload via PUT request

### Large Files (2GB - 5GB)
1. **Initiate Multipart**: Start chunked upload session  
2. **Upload Chunks**: Upload file in 10MB chunks in parallel
3. **Complete Upload**: Combine all chunks into final file

### Both Options
4. **Create Project**: Client creates project with S3 file URL and SRT
5. **Generate Clips**: Process video into clips based on timestamps

## API Endpoints

### Upload Endpoints

#### 1A. Single Upload - `POST /clips/upload/signed-url`
Generate a pre-signed URL for small files (< 2GB).

```bash
curl -X POST http://localhost:3000/clips/upload/signed-url \
  -H "Content-Type: application/json" \
  -d '{"fileName": "small-video.mp4", "fileType": "video/mp4", "fileSize": 52428800}'
```

#### 1B. Initiate Multipart Upload - `POST /clips/upload/multipart/initiate`
Start chunked upload for large files (2GB - 5GB).

```bash
curl -X POST http://localhost:3000/clips/upload/multipart/initiate \
  -H "Content-Type: application/json" \
  -d '{"fileName": "large-video.mp4", "fileType": "video/mp4", "fileSize": 524288000}'
```

**Response**:
```json
{
  "uploadId": "2~VmxqYWJRNHlzaTV4MGZSczNvZGJPSgabcd123",
  "fileKey": "videos/550e8400-e29b-41d4-a716-446655440000.mp4",
  "fileUrl": "https://bucket.s3.amazonaws.com/videos/550e8400-e29b-41d4-a716-446655440000.mp4",
  "chunkSize": 10485760,
  "totalChunks": 50,
  "expiresIn": 3600
}
```

#### 1C. Get Chunk Upload URL - `POST /clips/upload/multipart/chunk-url`
Get signed URL for each chunk/part.

```bash
curl -X POST http://localhost:3000/clips/upload/multipart/chunk-url \
  -H "Content-Type: application/json" \
  -d '{
    "uploadId": "2~VmxqYWJRNHlzaTV4MGZSczNvZGJPSgabcd123",
    "fileKey": "videos/550e8400-e29b-41d4-a716-446655440000.mp4",
    "partNumber": 1
  }'
```

#### 1D. Complete Multipart Upload - `POST /clips/upload/multipart/complete`
Combine all uploaded chunks into final file.

```bash
curl -X POST http://localhost:3000/clips/upload/multipart/complete \
  -H "Content-Type: application/json" \
  -d '{
    "uploadId": "2~VmxqYWJRNHlzaTV4MGZSczNvZGJPSgabcd123",
    "fileKey": "videos/550e8400-e29b-41d4-a716-446655440000.mp4",
    "parts": [
      {"partNumber": 1, "etag": "\"d41d8cd98f00b204e9800998ecf8427e\""},
      {"partNumber": 2, "etag": "\"098f6bcd4621d373cade4e832627b4f6\""}
    ]
  }'
```

#### 1E. Abort Multipart Upload - `POST /clips/upload/multipart/abort/:uploadId/:fileKey`
Cancel and cleanup a multipart upload session.

```bash
curl -X POST "http://localhost:3000/clips/upload/multipart/abort/UPLOAD_ID/FILE_KEY"
```

### Core Endpoints

### 2. Create Clip Project - `POST /clips`
Create a new clip project with title, SRT file, and video URL.

**Request**: Multipart form data
- `title` (string): Project name
- `videoUrl` (string): Direct video file URL or AWS S3 URL
- `srtFile` (file): SRT subtitle file

```bash
curl -X POST http://localhost:3000/clips \
  -F "title=My Video Project" \
  -F "videoUrl=https://bucket.s3.amazonaws.com/videos/my-video.mp4" \
  -F "srtFile=@subtitles.srt"
```

### 3. Get All Projects - `GET /clips`
Get all clip projects with pagination.

```bash
curl "http://localhost:3000/clips?page=1&limit=10"
```

### 4. Get Project Details - `GET /clips/:id`
Get detailed information about a specific project.

```bash
curl "http://localhost:3000/clips/60d5ecb74f3b2c001f5e4e8a"
```

### 5. Update Project - `PUT /clips/:id`
Update project with generated clips and timestamps.

```bash
curl -X PUT "http://localhost:3000/clips/60d5ecb74f3b2c001f5e4e8a" \
  -H "Content-Type: application/json" \
  -d '{"title": "Updated Title", "description": "Updated description"}'
```

### 6. Generate Clips - `POST /clips/:id/generate`
Generate video clips from user-provided timestamps.

```bash
curl -X POST "http://localhost:3000/clips/60d5ecb74f3b2c001f5e4e8a/generate" \
  -H "Content-Type: application/json" \
  -d '{
    "timestamps": [
      {
        "id": "intro",
        "startTime": 0,
        "endTime": 30,
        "title": "Introduction",
        "description": "Opening segment"
      },
      {
        "id": "main_topic",
        "startTime": 60,
        "endTime": 120,
        "title": "Main Topic",
        "description": "Core discussion"
      }
    ],
    "quality": "high",
    "format": "mp4"
  }'
```

## Quick Start

1. **Start the server**:
   ```bash
   npm install
   npm run start:dev
   ```

2. **Test the API**:
   ```bash
   # Test basic functionality
   ./test-simple-api.sh
   
   # Test single S3 upload flow (requires AWS credentials)
   ./test-s3-upload-api.sh
   
   # Test chunked S3 upload flow (requires AWS credentials)
   ./test-chunked-upload.sh
   ```

3. **Create your first project**:
   - Prepare an SRT file with timestamps
   - **Option A (Small Files)**: Use single signed URL:
     1. Call `POST /clips/upload/signed-url` to get upload URL
     2. Upload file directly to S3 using PUT request
     3. Use the returned `fileUrl` in project creation
   - **Option B (Large Files)**: Use chunked upload:
     1. Call `POST /clips/upload/multipart/initiate` to start upload session
     2. Upload file in 10MB chunks using signed URLs from `/chunk-url`
     3. Complete upload with `POST /clips/upload/multipart/complete`
     4. Use the returned `fileUrl` in project creation
   - **Option C**: Use existing S3 URL or direct video URL
   - Create project with `POST /clips` using title, videoUrl, and SRT file

## Response Format

All endpoints return JSON responses with consistent structure:

```json
{
  "id": "60d5ecb74f3b2c001f5e4e8a",
  "title": "My Video Project",
  "status": "completed",
  "rawFile": {
    "url": "https://bucket.s3.amazonaws.com/videos/my-video.mp4",
    "fileName": "my-video.mp4",
    "fileSize": 52428800
  },
  "srtFile": {
    "fileName": "subtitles.srt",
    "url": "/uploads/srt/subtitles.srt"
  },
  "totalDuration": 1800,
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-15T10:30:00Z"
}
```

## What's Removed

This simplified version has removed:
- ❌ Google Drive integration
- ❌ Authentication & user management
- ❌ Complex chunked upload systems
- ❌ AI theme analysis
- ❌ Advanced search & filtering
- ❌ Session management
- ❌ Complex validation

## What's Included

✅ **S3 Chunked Upload**: Multipart upload for large files (up to 5GB)  
✅ **S3 Single Upload**: Simple signed URL for smaller files (up to 2GB)  
✅ **Core CRUD**: Create, read, update clip projects  
✅ **Video Processing**: Generate clips from timestamps using FFmpeg  
✅ **SRT Support**: Parse subtitle files for duration and timestamps  
✅ **Clean API**: RESTful endpoints with proper error handling

## Tech Stack

- **Backend**: NestJS with TypeScript
- **Database**: MongoDB with Mongoose
- **Video Processing**: FFmpeg
- **File Storage**: Direct URLs and AWS S3 (including sub-accounts)

## AWS Configuration

### Standard S3 Setup
```bash
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=us-east-1
AWS_S3_BUCKET=your-bucket-name
```

### Sub-Account S3 Setup
If your S3 bucket is in an AWS sub-account (Organizations), add this configuration:
```bash
AWS_SUB_ACCOUNT_ROLE_ARN=arn:aws:iam::SUB_ACCOUNT_ID:role/CrossAccountS3Role
```

📖 **[Complete Sub-Account Setup Guide](./AWS_SUB_ACCOUNT_SETUP.md)**

Your ClipFlow API now supports efficient chunked uploads for any file size! 🎬