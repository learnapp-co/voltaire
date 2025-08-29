# ClipFlow Chunked Upload Test Scripts

This directory contains test scripts for testing the complete chunked upload flow using your actual screen recording file.

## 📁 Available Scripts

### 1. `test-real-file.sh` ⭐ **RECOMMENDED**
- **Purpose**: Tests the complete flow using your actual screen recording file
- **File**: Uses "Screen Recording 2025-08-22 at 11.26.52.mov" (13MB)
- **Features**: 
  - Real file size detection
  - Actual chunk calculations
  - Complete end-to-end testing
  - Creates real clip project

### 2. `quick-test.sh`
- **Purpose**: Quick basic testing with mock data
- **Features**: Fast testing, minimal output
- **Use case**: When you want to quickly verify API endpoints

### 3. `test-chunked-upload.sh`
- **Purpose**: Comprehensive testing with detailed output
- **Features**: Full validation, progress tracking, cleanup
- **Use case**: When you want thorough testing and debugging

## 🚀 Quick Start

### Prerequisites
1. **Install dependencies**:
   ```bash
   # macOS
   brew install jq curl
   
   # Ubuntu/Debian
   sudo apt-get install jq curl
   
   # CentOS/RHEL
   sudo yum install jq curl
   ```

2. **Start your NestJS server**:
   ```bash
   npm run start:dev
   ```

3. **Verify server is running**:
   ```bash
   curl http://localhost:3000
   ```

### Run the Test

#### Option 1: Test with Real File (Recommended)
```bash
./test-real-file.sh
```

This will:
- ✅ Detect your 13MB screen recording file
- ✅ Calculate optimal chunk sizes (5MB chunks = 3 chunks)
- ✅ Generate signed URLs for AWS S3 upload
- ✅ Simulate chunk uploads
- ✅ Complete the multipart upload
- ✅ Create a clip project using the AWS S3 file
- ✅ Show detailed progress and results

#### Option 2: Quick Test
```bash
./quick-test.sh
```

#### Option 3: Comprehensive Test
```bash
./test-chunked-upload.sh
```

## 📊 Expected Results

### File Analysis
- **File**: Screen Recording 2025-08-22 at 11.26.52.mov
- **Size**: 13MB (13,631,744 bytes)
- **Chunks**: 3 chunks (5MB + 5MB + 3.6MB)
- **Type**: video/quicktime

### API Flow
1. **Generate Signed URLs** → Get session ID and chunk URLs
2. **Upload Chunks** → Simulate uploading to AWS S3
3. **Track Progress** → Monitor upload completion
4. **Complete Upload** → Finalize multipart upload
5. **Create Project** → Use AWS file URL to create clip project

### Database Results
- **Upload Session**: Created with chunk information
- **Clip Project**: Created with AWS metadata
- **AWS Metadata**: Stored in clip document

## 🔧 Customization

### Change File Path
Edit the script to use a different file:
```bash
REAL_FILE_PATH="/path/to/your/video.mp4"
FILE_NAME="your_video.mp4"
```

### Change Chunk Size
Modify the chunk size (default: 5MB):
```bash
CHUNK_SIZE=10485760  # 10MB chunks
```

### Change Server URL
Use a different server:
```bash
BASE_URL="http://localhost:8080"
```

## 🐛 Troubleshooting

### Common Issues

1. **Server not running**
   ```bash
   npm run start:dev
   ```

2. **File not found**
   - Check file path in script
   - Ensure file exists and is readable

3. **Permission denied**
   ```bash
   chmod +x *.sh
   ```

4. **jq not found**
   ```bash
   brew install jq  # macOS
   sudo apt-get install jq  # Ubuntu
   ```

5. **curl not found**
   ```bash
   brew install curl  # macOS
   sudo apt-get install curl  # Ubuntu
   ```

### Debug Mode
Add `-v` flag to curl commands in scripts for verbose output:
```bash
curl -v -s -X POST "$API_BASE/upload/signed-url" ...
```

## 📝 What Happens After Testing

1. **Check MongoDB** for the created clip project
2. **Verify AWS S3** file is accessible
3. **Review upload session** data
4. **Test clip project** functionality

## 🎯 Next Steps

After successful testing:
1. Integrate the chunked upload flow into your frontend
2. Implement real file chunking and upload to AWS S3
3. Add progress bars and error handling
4. Implement resume functionality for interrupted uploads

## 📚 API Reference

### Endpoints Tested
- `POST /clips/upload/signed-url` - Generate upload URLs
- `POST /clips/upload/chunk/status` - Update chunk status
- `GET /clips/upload/progress/:sessionId` - Get upload progress
- `POST /clips/upload/chunk/complete` - Complete upload
- `POST /clips` - Create clip project with AWS file

### Response Formats
All responses are JSON with proper error handling and status codes.

---

**Happy Testing! 🚀**
