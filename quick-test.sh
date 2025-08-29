#!/bin/bash

# Quick Test Script for ClipFlow Chunked Upload
# Simple version for basic testing

BASE_URL="http://localhost:3000"
API_BASE="$BASE_URL/clips"

echo "🚀 ClipFlow Quick Test - Chunked Upload Flow"
echo "============================================="
echo ""

# Check if server is running
echo "Checking server status..."
if ! curl -s "$BASE_URL" > /dev/null 2>&1; then
    echo "❌ Server not running. Start with: npm run start:dev"
    exit 1
fi
echo "✅ Server is running"
echo ""

# Test 1: Generate signed URL
echo "1️⃣ Testing signed URL generation..."
RESPONSE=$(curl -s -X POST "$API_BASE/upload/signed-url" \
    -H "Content-Type: application/json" \
    -d '{
        "fileName": "Screen Recording 2025-08-22 at 11.26.52.mov",
        "fileSize": 52428800,
        "mimeType": "video/quicktime",
        "fileType": "video",
        "enableChunkedUpload": true,
        "chunkSize": 5242880
    }')

if echo "$RESPONSE" | grep -q "sessionId"; then
    echo "✅ Signed URL generated successfully"
    
    # Extract session ID
    SESSION_ID=$(echo "$RESPONSE" | grep -o '"sessionId":"[^"]*"' | cut -d'"' -f4)
    UPLOAD_ID=$(echo "$RESPONSE" | grep -o '"uploadId":"[^"]*"' | cut -d'"' -f4)
    
    echo "   Session ID: $SESSION_ID"
    echo "   Upload ID: $UPLOAD_ID"
else
    echo "❌ Failed to generate signed URL"
    echo "Response: $RESPONSE"
    exit 1
fi
echo ""

# Test 2: Check upload progress
echo "2️⃣ Testing upload progress..."
PROGRESS_RESPONSE=$(curl -s -X GET "$API_BASE/upload/progress/$SESSION_ID")
if echo "$PROGRESS_RESPONSE" | grep -q "totalChunks"; then
    echo "✅ Upload progress retrieved"
    TOTAL_CHUNKS=$(echo "$PROGRESS_RESPONSE" | grep -o '"totalChunks":[0-9]*' | cut -d':' -f2)
    echo "   Total chunks: $TOTAL_CHUNKS"
else
    echo "❌ Failed to get progress"
fi
echo ""

# Test 3: Complete upload (mock)
echo "3️⃣ Testing upload completion..."
COMPLETE_RESPONSE=$(curl -s -X POST "$API_BASE/upload/chunk/complete" \
    -H "Content-Type: application/json" \
    -d "{
        \"sessionId\": \"$SESSION_ID\",
        \"uploadId\": \"$UPLOAD_ID\"
    }")

if echo "$COMPLETE_RESPONSE" | grep -q "finalFileUrl"; then
    echo "✅ Upload completed successfully"
    FINAL_URL=$(echo "$COMPLETE_RESPONSE" | grep -o '"finalFileUrl":"[^"]*"' | cut -d'"' -f4)
    echo "   Final URL: $FINAL_URL"
else
    echo "❌ Failed to complete upload"
    echo "Response: $COMPLETE_RESPONSE"
fi
echo ""

# Test 4: Create clip project with AWS file
echo "4️⃣ Testing clip project creation..."
# Create a simple SRT file
echo "1
00:00:00,000 --> 00:00:05,000
Test subtitle for chunked upload

2
00:00:05,000 --> 00:00:10,000
Another test subtitle line" > test.srt

# Create multipart form data
BOUNDARY="test123"
FORM_DATA="--$BOUNDARY\r\n"
FORM_DATA+="Content-Disposition: form-data; name=\"title\"\r\n\r\n"
FORM_DATA+="Screen Recording Test Project\r\n"
FORM_DATA+="--$BOUNDARY\r\n"
FORM_DATA+="Content-Disposition: form-data; name=\"awsFileUrl\"\r\n\r\n"
FORM_DATA+="$FINAL_URL\r\n"
FORM_DATA+="--$BOUNDARY\r\n"
FORM_DATA+="Content-Disposition: form-data; name=\"uploadSessionId\"\r\n\r\n"
FORM_DATA+="$SESSION_ID\r\n"
FORM_DATA+="--$BOUNDARY\r\n"
FORM_DATA+="Content-Disposition: form-data; name=\"srtFile\"; filename=\"test.srt\"\r\n"
FORM_DATA+="Content-Type: text/plain\r\n\r\n"
FORM_DATA+="$(cat test.srt)\r\n"
FORM_DATA+="--$BOUNDARY--\r\n"

CLIP_RESPONSE=$(curl -s -X POST "$API_BASE" \
    -H "Content-Type: multipart/form-data; boundary=$BOUNDARY" \
    -d "$FORM_DATA")

if echo "$CLIP_RESPONSE" | grep -q "id"; then
    echo "✅ Clip project created successfully"
    CLIP_ID=$(echo "$CLIP_RESPONSE" | grep -o '"_id":"[^"]*"' | cut -d'"' -f4)
    echo "   Clip ID: $CLIP_ID"
else
    echo "❌ Failed to create clip project"
    echo "Response: $CLIP_RESPONSE"
fi

# Cleanup
rm -f test.srt

echo ""
echo "🎉 Quick test completed!"
echo ""
echo "Next steps:"
echo "1. Check your database for the created clip project"
echo "2. Verify the AWS S3 file is accessible"
echo "3. Run the full test script: ./test-chunked-upload.sh"
