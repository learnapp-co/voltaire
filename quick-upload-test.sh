#!/bin/bash

# Quick Upload and Create Test for ClipFlow
# Tests basic file upload and clip project creation workflow

# Configuration
JWT_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2OGI1NGE1NmJmY2FkNjViZjIzMDg2OGUiLCJlbWFpbCI6ImlhbXNhaGlsc2h1a2xhQGdtYWlsLmNvbSIsImlhdCI6MTc1NjcxMTY5NiwiZXhwIjoxNzg4MjQ3Njk2fQ.-dOlW6UTNi4MJwRE8vwZtv-JYJ-wUrljXux0NyQ0xcw"
BASE_URL="http://localhost:3000"
API_BASE="${BASE_URL}"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${YELLOW}🚀 Quick ClipFlow Upload & Create Test${NC}"
echo "User: iamsahilshukla@gmail.com"

# Create SRT file
SRT_CONTENT="1
00:00:00,000 --> 00:00:05,000
Quick test subtitle one.

2
00:00:05,000 --> 00:00:10,000
Quick test subtitle two."

echo "$SRT_CONTENT" > quick-test.srt

# Step 1: Generate signed URL for upload
echo -e "\n${YELLOW}1. Generating S3 signed URL...${NC}"
SIGNED_URL_RESPONSE=$(curl -s -X POST \
  "${API_BASE}/clips/upload/signed-url" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "fileName": "quick-test-video.mp4",
    "fileType": "video/mp4", 
    "fileSize": 1048576
  }')

echo "$SIGNED_URL_RESPONSE" | jq '.'

VIDEO_URL=$(echo "$SIGNED_URL_RESPONSE" | jq -r '.fileUrl // empty')
if [ -z "$VIDEO_URL" ] || [ "$VIDEO_URL" = "null" ]; then
    echo -e "${YELLOW}⚠️  Using demo video URL instead${NC}"
    VIDEO_URL="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"
fi

echo -e "${GREEN}✅ Video URL: $VIDEO_URL${NC}"

# Step 2: Create clip project
echo -e "\n${YELLOW}2. Creating clip project...${NC}"
CREATE_RESPONSE=$(curl -s -X POST \
  "${API_BASE}/clips" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -F "title=Quick Upload Test Project" \
  -F "videoUrl=${VIDEO_URL}" \
  -F "srtFile=@quick-test.srt")

echo "$CREATE_RESPONSE" | jq '.'

PROJECT_ID=$(echo "$CREATE_RESPONSE" | jq -r '.id // empty')
if [ -n "$PROJECT_ID" ] && [ "$PROJECT_ID" != "null" ]; then
    echo -e "${GREEN}✅ Project created: $PROJECT_ID${NC}"
    
    # Step 3: Quick invitation test
    echo -e "\n${YELLOW}3. Testing quick invitation...${NC}"
    INVITE_RESPONSE=$(curl -s -X POST \
      "${API_BASE}/clips/${PROJECT_ID}/collaborators/invite" \
      -H "Authorization: Bearer ${JWT_TOKEN}" \
      -H "Content-Type: application/json" \
      -d '{
        "email": "quick-test@example.com",
        "message": "Quick upload test invitation"
      }')
    
    echo "$INVITE_RESPONSE" | jq '.'
    
    if echo "$INVITE_RESPONSE" | jq -e '.success' >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Invitation sent successfully!${NC}"
    else
        echo -e "${RED}❌ Invitation failed${NC}"
    fi
else
    echo -e "${RED}❌ Project creation failed${NC}"
fi

# Cleanup
rm -f quick-test.srt

echo -e "\n${GREEN}✅ Quick test completed!${NC}"
echo -e "${BLUE}💡 For full workflow test, run: ./test-complete-workflow.sh${NC}"
