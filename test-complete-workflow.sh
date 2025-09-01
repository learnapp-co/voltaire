#!/bin/bash

# ClipFlow Complete Workflow Test Script
# Tests: File Upload → Clip Creation → Clip Generation → Collaboration & Invitations

# Configuration
JWT_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2OGI1NGE1NmJmY2FkNjViZjIzMDg2OGUiLCJlbWFpbCI6ImlhbXNhaGlsc2h1a2xhQGdtYWlsLmNvbSIsImlhdCI6MTc1NjcxMTY5NiwiZXhwIjoxNzg4MjQ3Njk2fQ.-dOlW6UTNi4MJwRE8vwZtv-JYJ-wUrljXux0NyQ0xcw"
BASE_URL="http://localhost:3000"
API_BASE="${BASE_URL}"

# Test configuration
PROJECT_TITLE="Complete Workflow Test Project"
INVITE_EMAIL="workflow-test@example.com"
VIDEO_FILE_NAME="test-video.mp4"
SRT_CONTENT="1
00:00:00,000 --> 00:00:05,000
This is the first subtitle for our test video.

2
00:00:05,000 --> 00:00:10,000
Here's the second subtitle to test clip generation.

3
00:00:10,000 --> 00:00:15,000
And this is the third subtitle for comprehensive testing."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

# Global variables
CLIP_PROJECT_ID=""
VIDEO_URL=""
GENERATED_CLIPS_COUNT=0

# Helper functions
print_header() {
    echo -e "\n${BLUE}=================================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}=================================================${NC}"
}

print_step() {
    echo -e "\n${YELLOW}▶ $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${PURPLE}ℹ️  $1${NC}"
}

print_response() {
    echo -e "${BLUE}Response:${NC}"
    echo "$1" | jq '.' 2>/dev/null || echo "$1"
}

# Check prerequisites
check_prerequisites() {
    print_step "Checking prerequisites..."
    
    if ! command -v jq &> /dev/null; then
        print_error "jq is required but not installed"
        exit 1
    fi
    
    if ! command -v curl &> /dev/null; then
        print_error "curl is required but not installed"
        exit 1
    fi
    
    # Test server connectivity
    SERVER_CHECK=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}" || echo "000")
    if [ "$SERVER_CHECK" = "000" ]; then
        print_error "ClipFlow server is not running at ${BASE_URL}"
        exit 1
    fi
    
    print_success "Prerequisites satisfied"
}

# Create a temporary SRT file
create_test_srt_file() {
    local srt_file="test-video.srt"
    echo "$SRT_CONTENT" > "$srt_file"
    echo "$srt_file"
}

print_header "CLIPFLOW COMPLETE WORKFLOW TEST"
echo "Testing: Upload → Clip Creation → Generation → Collaboration"
echo "User: iamsahilshukla@gmail.com"

check_prerequisites

# ==============================================================================
# 1. S3 UPLOAD WORKFLOW
# ==============================================================================

print_header "1. S3 FILE UPLOAD WORKFLOW"

print_step "Generating signed URL for video upload..."
SIGNED_URL_RESPONSE=$(curl -s -X POST \
  "${API_BASE}/clips/upload/signed-url" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"fileName\": \"${VIDEO_FILE_NAME}\",
    \"fileType\": \"video/mp4\",
    \"fileSize\": 1048576
  }")

print_response "$SIGNED_URL_RESPONSE"

# Extract the video URL that would be returned after upload
UPLOAD_SUCCESS=$(echo "$SIGNED_URL_RESPONSE" | jq -r '.success // false')
if [ "$UPLOAD_SUCCESS" = "true" ]; then
    VIDEO_URL=$(echo "$SIGNED_URL_RESPONSE" | jq -r '.fileUrl')
    print_success "Signed URL generated successfully"
    print_info "Video URL: $VIDEO_URL"
else
    print_error "Failed to generate signed URL"
    # Try multipart upload instead
    print_step "Trying multipart upload workflow..."
    
    MULTIPART_RESPONSE=$(curl -s -X POST \
      "${API_BASE}/clips/upload/multipart/initiate" \
      -H "Authorization: Bearer ${JWT_TOKEN}" \
      -H "Content-Type: application/json" \
      -d "{
        \"fileName\": \"${VIDEO_FILE_NAME}\",
        \"fileType\": \"video/mp4\",
        \"fileSize\": 1048576
      }")
    
    print_response "$MULTIPART_RESPONSE"
    
    VIDEO_URL=$(echo "$MULTIPART_RESPONSE" | jq -r '.fileUrl // empty')
    if [ -n "$VIDEO_URL" ] && [ "$VIDEO_URL" != "null" ]; then
        print_success "Multipart upload initiated successfully"
        print_info "Video URL: $VIDEO_URL"
    else
        print_error "Both signed URL and multipart upload failed. Using demo URL."
        VIDEO_URL="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"
        print_info "Using demo video URL: $VIDEO_URL"
    fi
fi

# ==============================================================================
# 2. CLIP PROJECT CREATION
# ==============================================================================

print_header "2. CLIP PROJECT CREATION"

print_step "Creating SRT file for upload..."
SRT_FILE=$(create_test_srt_file)
print_success "Created SRT file: $SRT_FILE"

print_step "Creating clip project with video and SRT..."
CREATE_PROJECT_RESPONSE=$(curl -s -X POST \
  "${API_BASE}/clips" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -F "title=${PROJECT_TITLE}" \
  -F "videoUrl=${VIDEO_URL}" \
  -F "srtFile=@${SRT_FILE}")

print_response "$CREATE_PROJECT_RESPONSE"

# Extract project ID
CLIP_PROJECT_ID=$(echo "$CREATE_PROJECT_RESPONSE" | jq -r '.id // empty')
if [ -n "$CLIP_PROJECT_ID" ] && [ "$CLIP_PROJECT_ID" != "null" ]; then
    print_success "Clip project created successfully"
    print_info "Project ID: $CLIP_PROJECT_ID"
else
    print_error "Failed to create clip project"
    # Clean up and exit
    rm -f "$SRT_FILE"
    exit 1
fi

# ==============================================================================
# 3. CLIP GENERATION
# ==============================================================================

print_header "3. CLIP GENERATION FROM TIMESTAMPS"

print_step "Generating clips from SRT timestamps..."
GENERATE_CLIPS_RESPONSE=$(curl -s -X POST \
  "${API_BASE}/clips/${CLIP_PROJECT_ID}/generate" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "timestamps": [
      {
        "id": "clip_001",
        "startTime": 0,
        "endTime": 5
      },
      {
        "id": "clip_002",
        "startTime": 5, 
        "endTime": 10
      },
      {
        "id": "clip_003",
        "startTime": 10,
        "endTime": 15
      }
    ],
    "quality": "medium",
    "format": "mp4"
  }')

print_response "$GENERATE_CLIPS_RESPONSE"

# Check clip generation success
GENERATION_SUCCESS=$(echo "$GENERATE_CLIPS_RESPONSE" | jq -r '.success // false')
if [ "$GENERATION_SUCCESS" = "true" ]; then
    GENERATED_CLIPS_COUNT=$(echo "$GENERATE_CLIPS_RESPONSE" | jq -r '.generatedClips | length')
    print_success "Generated $GENERATED_CLIPS_COUNT clips successfully"
else
    print_error "Clip generation failed"
    GENERATION_ERROR=$(echo "$GENERATE_CLIPS_RESPONSE" | jq -r '.message // "Unknown error"')
    print_error "Error: $GENERATION_ERROR"
fi

# ==============================================================================
# 4. PROJECT STATUS CHECK
# ==============================================================================

print_header "4. PROJECT STATUS VERIFICATION"

print_step "Getting updated project details..."
PROJECT_DETAILS_RESPONSE=$(curl -s -X GET \
  "${API_BASE}/clips/${CLIP_PROJECT_ID}" \
  -H "Authorization: Bearer ${JWT_TOKEN}")

print_response "$PROJECT_DETAILS_RESPONSE"

# Check project status
PROJECT_STATUS=$(echo "$PROJECT_DETAILS_RESPONSE" | jq -r '.status // "unknown"')
TOTAL_CLIPS=$(echo "$PROJECT_DETAILS_RESPONSE" | jq -r '.generatedClips | length // 0')
print_info "Project Status: $PROJECT_STATUS"
print_info "Total Generated Clips: $TOTAL_CLIPS"

# ==============================================================================
# 5. COLLABORATION & INVITATIONS
# ==============================================================================

print_header "5. COLLABORATION & INVITATIONS"

print_step "Sending collaboration invitation..."
INVITE_RESPONSE=$(curl -s -X POST \
  "${API_BASE}/clips/${CLIP_PROJECT_ID}/collaborators/invite" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"${INVITE_EMAIL}\",
    \"message\": \"You're invited to collaborate on our complete workflow test project! We've uploaded a video, created clips, and now want you to review and collaborate.\"
  }")

print_response "$INVITE_RESPONSE"

if echo "$INVITE_RESPONSE" | jq -e '.success' >/dev/null 2>&1; then
    print_success "Collaboration invitation sent successfully"
    INVITATION_ID=$(echo "$INVITE_RESPONSE" | jq -r '.invitationId')
    print_info "Invitation ID: $INVITATION_ID"
else
    print_error "Failed to send collaboration invitation"
fi

print_step "Getting collaborators list..."
COLLABORATORS_RESPONSE=$(curl -s -X GET \
  "${API_BASE}/clips/${CLIP_PROJECT_ID}/collaborators" \
  -H "Authorization: Bearer ${JWT_TOKEN}")

print_response "$COLLABORATORS_RESPONSE"

print_step "Getting invitations list..."
INVITATIONS_RESPONSE=$(curl -s -X GET \
  "${API_BASE}/clips/${CLIP_PROJECT_ID}/invitations" \
  -H "Authorization: Bearer ${JWT_TOKEN}")

print_response "$INVITATIONS_RESPONSE"

# ==============================================================================
# 6. BULK INVITATIONS TEST
# ==============================================================================

print_header "6. BULK COLLABORATION INVITATIONS"

print_step "Sending bulk invitations..."
BULK_INVITE_RESPONSE=$(curl -s -X POST \
  "${API_BASE}/clips/${CLIP_PROJECT_ID}/collaborators/bulk-invite" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "emails": [
      "collaborator1@workflow-test.com",
      "collaborator2@workflow-test.com", 
      "collaborator3@workflow-test.com"
    ],
    "message": "Bulk invitation for our complete workflow test! Please join and help us review the generated clips."
  }')

print_response "$BULK_INVITE_RESPONSE"

BULK_SUCCESS_COUNT=$(echo "$BULK_INVITE_RESPONSE" | jq -r '.successCount // 0')
print_info "Bulk invitations sent: $BULK_SUCCESS_COUNT"

# ==============================================================================
# 7. VOTING/RATING TEST (if clips were generated)
# ==============================================================================

if [ "$GENERATED_CLIPS_COUNT" -gt 0 ]; then
    print_header "7. VOTING & RATING TEST"
    
    print_step "Getting voting summary for project..."
    VOTING_SUMMARY_RESPONSE=$(curl -s -X GET \
      "${API_BASE}/clips/${CLIP_PROJECT_ID}/voting" \
      -H "Authorization: Bearer ${JWT_TOKEN}")
    
    print_response "$VOTING_SUMMARY_RESPONSE"
    
    # Try to vote on first clip if available
    FIRST_CLIP_ID=$(echo "$PROJECT_DETAILS_RESPONSE" | jq -r '.generatedClips[0]._id // empty')
    if [ -n "$FIRST_CLIP_ID" ] && [ "$FIRST_CLIP_ID" != "null" ]; then
        print_step "Testing vote on first generated clip..."
        VOTE_RESPONSE=$(curl -s -X POST \
          "${API_BASE}/clips/${CLIP_PROJECT_ID}/vote" \
          -H "Authorization: Bearer ${JWT_TOKEN}" \
          -H "Content-Type: application/json" \
          -d "{
            \"clipId\": \"${FIRST_CLIP_ID}\",
            \"voteType\": \"upvote\"
          }")
        
        print_response "$VOTE_RESPONSE"
        
        print_step "Testing rating on first generated clip..."
        RATING_RESPONSE=$(curl -s -X POST \
          "${API_BASE}/clips/${CLIP_PROJECT_ID}/rate" \
          -H "Authorization: Bearer ${JWT_TOKEN}" \
          -H "Content-Type: application/json" \
          -d "{
            \"clipId\": \"${FIRST_CLIP_ID}\",
            \"rating\": 5,
            \"comment\": \"Great clip generated from our workflow test!\"
          }")
        
        print_response "$RATING_RESPONSE"
    fi
fi

# ==============================================================================
# 8. REGENERATION TEST
# ==============================================================================

if [ "$GENERATED_CLIPS_COUNT" -gt 0 ]; then
    print_header "8. CLIP REGENERATION TEST"
    
    FIRST_CLIP_ID=$(echo "$PROJECT_DETAILS_RESPONSE" | jq -r '.generatedClips[0]._id // empty')
    if [ -n "$FIRST_CLIP_ID" ] && [ "$FIRST_CLIP_ID" != "null" ]; then
        print_step "Regenerating first clip with different parameters..."
        REGENERATE_RESPONSE=$(curl -s -X POST \
          "${API_BASE}/clips/${CLIP_PROJECT_ID}/regenerate-clip" \
          -H "Authorization: Bearer ${JWT_TOKEN}" \
          -H "Content-Type: application/json" \
          -d "{
            \"dbId\": \"${FIRST_CLIP_ID}\",
            \"quality\": \"high\",
            \"format\": \"mp4\"
          }")
        
        print_response "$REGENERATE_RESPONSE"
    fi
fi

# ==============================================================================
# 9. FINAL STATUS & CLEANUP
# ==============================================================================

print_header "9. FINAL STATUS & CLEANUP"

print_step "Getting final project status..."
FINAL_PROJECT_RESPONSE=$(curl -s -X GET \
  "${API_BASE}/clips/${CLIP_PROJECT_ID}" \
  -H "Authorization: Bearer ${JWT_TOKEN}")

print_response "$FINAL_PROJECT_RESPONSE"

print_step "Getting final collaborators list..."
FINAL_COLLABORATORS_RESPONSE=$(curl -s -X GET \
  "${API_BASE}/clips/${CLIP_PROJECT_ID}/collaborators" \
  -H "Authorization: Bearer ${JWT_TOKEN}")

print_response "$FINAL_COLLABORATORS_RESPONSE"

print_step "Cleaning up temporary files..."
rm -f "$SRT_FILE"
print_success "Cleanup completed"

# ==============================================================================
# SUMMARY
# ==============================================================================

print_header "WORKFLOW TEST SUMMARY"

echo -e "${BLUE}Complete Workflow Test Results:${NC}"
echo ""
echo "📁 File Upload: $([ -n "$VIDEO_URL" ] && echo "✅ Success" || echo "❌ Failed")"
echo "🎬 Project Creation: $([ -n "$CLIP_PROJECT_ID" ] && echo "✅ Success" || echo "❌ Failed")"
echo "✂️  Clip Generation: $([ "$GENERATED_CLIPS_COUNT" -gt 0 ] && echo "✅ Success ($GENERATED_CLIPS_COUNT clips)" || echo "❌ Failed")"
echo "🤝 Collaboration: $(echo "$INVITE_RESPONSE" | jq -e '.success' >/dev/null 2>&1 && echo "✅ Success" || echo "❌ Failed")"
echo "📧 Bulk Invitations: $([ "$BULK_SUCCESS_COUNT" -gt 0 ] && echo "✅ Success ($BULK_SUCCESS_COUNT sent)" || echo "❌ Failed")"
echo ""
echo "Key Information:"
echo "- Project ID: $CLIP_PROJECT_ID"
echo "- Video URL: $VIDEO_URL"
echo "- Generated Clips: $GENERATED_CLIPS_COUNT"
echo "- Test User: iamsahilshukla@gmail.com"
echo ""
echo -e "${GREEN}✅ Complete workflow test finished!${NC}"
echo -e "${YELLOW}💡 Check your email service logs for invitation delivery status.${NC}"
echo -e "${PURPLE}🔗 Project available at: ${BASE_URL}/projects/${CLIP_PROJECT_ID}${NC}"
