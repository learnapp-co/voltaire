#!/bin/bash

# =============================================================================
# ClipFlow API - Complete User Flow Test with cURL (Production)
# Testing against: clipflow-production.up.railway.app
# =============================================================================

# Configuration
BASE_URL="https://clipflow-production.up.railway.app"
TEST_PROJECT_TITLE="My Test Podcast"
TEST_VIDEO_URL="https://your-bucket.s3.amazonaws.com/videos/test-video.mp4"
ACCESS_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2OGFjMmQ4Y2MzNzY3NjQ0ZjZhYzdmZjUiLCJlbWFpbCI6ImlhbXNhaGlsc2h1a2xhQGdtYWlsLmNvbSIsImlhdCI6MTc1NjEyMzc0MSwiZXhwIjoxNzg3NjU5NzQxfQ.psXWLY4mhXvnj3sgs5bEA4puuxQ-VgrOtWsPPsc0TDI"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print section headers
print_section() {
    echo -e "\n${BLUE}=== $1 ===${NC}\n"
}

# Function to print step
print_step() {
    echo -e "${YELLOW}Step: $1${NC}"
}

# Function to print success
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

# Function to print error
print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# =============================================================================
# 1. S3 UPLOAD WORKFLOW
# =============================================================================

print_section "1. S3 UPLOAD WORKFLOW"

print_step "Using provided access token"
echo "Access Token: ${ACCESS_TOKEN:0:50}..."

# 1.1 Generate signed URL for small file upload
print_step "1.1 Generate signed URL for small file upload"
SIGNED_URL_RESPONSE=$(curl -s -X POST "$BASE_URL/clips/upload/signed-url" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fileName": "test-video.mp4",
    "fileSize": 10485760,
    "fileType": "video/mp4"
  }')

echo "Signed URL Response:"
echo "$SIGNED_URL_RESPONSE" | jq '.'

UPLOAD_URL=$(echo "$SIGNED_URL_RESPONSE" | jq -r '.uploadUrl // empty')
FILE_NAME=$(echo "$SIGNED_URL_RESPONSE" | jq -r '.fileName // empty')

if [ -n "$UPLOAD_URL" ] && [ "$UPLOAD_URL" != "null" ]; then
    print_success "Signed URL generated successfully"
    echo "Upload URL: $UPLOAD_URL"
    echo "File Name: $FILE_NAME"
    TEST_VIDEO_URL=$(echo "$SIGNED_URL_RESPONSE" | jq -r '.fileUrl // empty')
else
    print_error "Failed to generate signed URL"
fi

# 1.2 Initiate multipart upload (for large files)
print_step "1.2 Initiate multipart upload"
MULTIPART_INIT_RESPONSE=$(curl -s -X POST "$BASE_URL/clips/upload/multipart/initiate" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fileName": "large-video.mp4",
    "fileSize": 104857600,
    "fileType": "video/mp4"
  }')

echo "Multipart Upload Initiation Response:"
echo "$MULTIPART_INIT_RESPONSE" | jq '.'

UPLOAD_ID=$(echo "$MULTIPART_INIT_RESPONSE" | jq -r '.uploadId // empty')
MULTIPART_FILE_KEY=$(echo "$MULTIPART_INIT_RESPONSE" | jq -r '.fileKey // empty')

if [ -n "$UPLOAD_ID" ] && [ "$UPLOAD_ID" != "null" ]; then
    print_success "Multipart upload initiated successfully"
    echo "Upload ID: $UPLOAD_ID"
    echo "File Key: $MULTIPART_FILE_KEY"
    
    # 1.3 Get chunk upload URL
    print_step "1.3 Get chunk upload URL"
    CHUNK_URL_RESPONSE=$(curl -s -X POST "$BASE_URL/clips/upload/multipart/chunk-url" \
      -H "Authorization: Bearer $ACCESS_TOKEN" \
      -H "Content-Type: application/json" \
      -d "{
        \"uploadId\": \"$UPLOAD_ID\",
        \"partNumber\": 1,
        \"fileKey\": \"$MULTIPART_FILE_KEY\"
      }")
    
    echo "Chunk Upload URL Response:"
    echo "$CHUNK_URL_RESPONSE" | jq '.'
    
    # 1.4 Complete multipart upload (example)
    print_step "1.4 Complete multipart upload (example)"
    COMPLETE_MULTIPART_RESPONSE=$(curl -s -X POST "$BASE_URL/clips/upload/multipart/complete" \
      -H "Authorization: Bearer $ACCESS_TOKEN" \
      -H "Content-Type: application/json" \
      -d "{
        \"uploadId\": \"$UPLOAD_ID\",
        \"fileKey\": \"$MULTIPART_FILE_KEY\",
        \"parts\": [
          {
            \"partNumber\": 1,
            \"etag\": \"example-etag-123\"
          }
        ]
      }")
    
    echo "Complete Multipart Upload Response:"
    echo "$COMPLETE_MULTIPART_RESPONSE" | jq '.'
else
    print_error "Failed to initiate multipart upload"
fi

# =============================================================================
# 2. CLIP PROJECT MANAGEMENT
# =============================================================================

print_section "2. CLIP PROJECT MANAGEMENT"

# 2.1 Create a test SRT file
print_step "2.1 Create test SRT file"
SRT_FILE="test-subtitles.srt"
cat > "$SRT_FILE" << EOF
1
00:00:01,000 --> 00:00:05,000
Welcome to our podcast episode.

2
00:00:05,500 --> 00:00:10,000
Today we'll be discussing important topics.

3
00:00:10,500 --> 00:00:15,000
Let's dive into the main content.

4
00:00:15,500 --> 00:00:20,000
This is a great example of our discussion.

5
00:00:20,500 --> 00:00:25,000
Thank you for listening to our podcast.
EOF

print_success "Test SRT file created: $SRT_FILE"

# 2.2 Create clip project
print_step "2.2 Create clip project"
CREATE_PROJECT_RESPONSE=$(curl -s -X POST "$BASE_URL/clips" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -F "title=$TEST_PROJECT_TITLE" \
  -F "videoUrl=$TEST_VIDEO_URL" \
  -F "srtFile=@$SRT_FILE")

echo "Create Project Response:"
echo "$CREATE_PROJECT_RESPONSE" | jq '.'

PROJECT_ID=$(echo "$CREATE_PROJECT_RESPONSE" | jq -r '.id // empty')

if [ -n "$PROJECT_ID" ] && [ "$PROJECT_ID" != "null" ]; then
    print_success "Clip project created successfully"
    echo "Project ID: $PROJECT_ID"
else
    print_error "Failed to create clip project"
fi

# 2.3 Get all clip projects
print_step "2.3 Get all clip projects"
GET_PROJECTS_RESPONSE=$(curl -s -X GET "$BASE_URL/clips?page=1&limit=10" \
  -H "Authorization: Bearer $ACCESS_TOKEN")

echo "Get Projects Response:"
echo "$GET_PROJECTS_RESPONSE" | jq '.'

# 3.4 Get specific clip project
if [ -n "$PROJECT_ID" ] && [ "$PROJECT_ID" != "null" ]; then
    print_step "2.4 Get specific clip project"
    GET_PROJECT_RESPONSE=$(curl -s -X GET "$BASE_URL/clips/$PROJECT_ID" \
      -H "Authorization: Bearer $ACCESS_TOKEN")
    
    echo "Get Project Response:"
    echo "$GET_PROJECT_RESPONSE" | jq '.'
fi

# 3.5 Update clip project
if [ -n "$PROJECT_ID" ] && [ "$PROJECT_ID" != "null" ]; then
    print_step "2.5 Update clip project"
    UPDATE_PROJECT_RESPONSE=$(curl -s -X PUT "$BASE_URL/clips/$PROJECT_ID" \
      -H "Authorization: Bearer $ACCESS_TOKEN" \
      -H "Content-Type: application/json" \
      -d '{
        "title": "Updated Test Podcast",
        "description": "This is an updated description for the test podcast project."
      }')
    
    echo "Update Project Response:"
    echo "$UPDATE_PROJECT_RESPONSE" | jq '.'
fi

# =============================================================================
# 3. CLIP GENERATION
# =============================================================================

print_section "3. CLIP GENERATION"

if [ -n "$PROJECT_ID" ] && [ "$PROJECT_ID" != "null" ]; then
    print_step "3.1 Generate clips from timestamps"
    GENERATE_CLIPS_RESPONSE=$(curl -s -X POST "$BASE_URL/clips/$PROJECT_ID/generate" \
      -H "Authorization: Bearer $ACCESS_TOKEN" \
      -H "Content-Type: application/json" \
      -d '{
        "timestamps": [
          {
            "id": "clip_001",
            "startTime": 1.0,
            "endTime": 10.0,
            "title": "Introduction Clip",
            "description": "Opening remarks and welcome"
          },
          {
            "id": "clip_002", 
            "startTime": 10.5,
            "endTime": 20.0,
            "title": "Main Discussion",
            "description": "Core content discussion"
          }
        ]
      }')
    
    echo "Generate Clips Response:"
    echo "$GENERATE_CLIPS_RESPONSE" | jq '.'
    
    if echo "$GENERATE_CLIPS_RESPONSE" | jq -e '.generatedClips' > /dev/null; then
        print_success "Clips generated successfully"
        GENERATED_COUNT=$(echo "$GENERATE_CLIPS_RESPONSE" | jq '.generatedClips | length')
        echo "Generated $GENERATED_COUNT clips successfully"
    else
        print_error "Failed to generate clips"
    fi
fi

# =============================================================================
# 4. USER MANAGEMENT
# =============================================================================

print_section "4. USER MANAGEMENT"

# 4.1 Get user details
print_step "4.1 Get user details"
USER_DETAILS_RESPONSE=$(curl -s -X GET "$BASE_URL/users" \
  -H "Authorization: Bearer $ACCESS_TOKEN")

echo "User Details Response:"
echo "$USER_DETAILS_RESPONSE" | jq '.'

# 4.2 Update user details
print_step "4.2 Update user details"
UPDATE_USER_RESPONSE=$(curl -s -X PATCH "$BASE_URL/users" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "John Updated",
    "lastName": "Doe Updated"
  }')

echo "Update User Response:"
echo "$UPDATE_USER_RESPONSE" | jq '.'

# =============================================================================
# CLEANUP
# =============================================================================

print_section "CLEANUP"

# Remove test SRT file
if [ -f "$SRT_FILE" ]; then
    rm "$SRT_FILE"
    print_success "Test SRT file removed"
fi

# =============================================================================
# SUMMARY
# =============================================================================

print_section "TEST SUMMARY"

echo -e "${GREEN}Complete user flow test finished!${NC}"
echo ""
echo "Key Points:"
echo "1. Make sure your server is running on $BASE_URL"
echo "2. Using provided JWT token for authentication"
echo "3. Ensure AWS S3 credentials are properly configured"
echo "4. Replace TEST_VIDEO_URL with an actual S3 URL after upload"
echo ""
echo "Test sequence covered:"
echo "✓ S3 upload workflows (single and multipart)"
echo "✓ Clip project creation and management"
echo "✓ Clip generation from timestamps"
echo "✓ User profile management"
