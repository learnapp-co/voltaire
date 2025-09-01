#!/bin/bash

# ClipFlow Invitation and Collaboration Feature Test Script
# This script tests the complete invitation and collaboration workflow

# Configuration
JWT_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2OGI1NGE1NmJmY2FkNjViZjIzMDg2OGUiLCJlbWFpbCI6ImlhbXNhaGlsc2h1a2xhQGdtYWlsLmNvbSIsImlhdCI6MTc1NjcxMTY5NiwiZXhwIjoxNzg4MjQ3Njk2fQ.-dOlW6UTNi4MJwRE8vwZtv-JYJ-wUrljXux0NyQ0xcw"
BASE_URL="http://localhost:3000"  # Change this to your server URL
API_BASE="${BASE_URL}"

# Test emails to invite
INVITE_EMAIL_1="collaborator1@example.com"
INVITE_EMAIL_2="collaborator2@example.com"
INVITE_EMAIL_3="collaborator3@example.com"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
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

print_response() {
    echo -e "${BLUE}Response:${NC}"
    echo "$1" | jq '.' 2>/dev/null || echo "$1"
}

# Check if jq is installed
if ! command -v jq &> /dev/null; then
    print_error "jq is required but not installed. Please install jq to run this script."
    exit 1
fi

# Variables to store test data
CLIP_ID=""
INVITATION_TOKEN=""
COLLABORATOR_USER_ID=""

print_header "CLIPFLOW INVITATION & COLLABORATION TEST SUITE"
echo "Testing with JWT Token for user: iamsahilshukla@gmail.com"
echo "User ID: 68b54a56bfcad65bf230868e"

# ==============================================================================
# 1. TEST SETUP - Get or Create a Clip Project
# ==============================================================================

print_header "1. SETUP - GET EXISTING CLIPS OR CREATE NEW ONE"

print_step "Getting list of existing clips..."
CLIPS_RESPONSE=$(curl -s -X GET \
  "${API_BASE}/clips" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json")

print_response "$CLIPS_RESPONSE"

# Extract the first clip ID if clips exist
CLIP_ID=$(echo "$CLIPS_RESPONSE" | jq -r '.clips[0].id // empty' 2>/dev/null)

if [ -z "$CLIP_ID" ] || [ "$CLIP_ID" = "null" ]; then
    print_step "No existing clips found. Creating a new clip project for testing..."
    
    # Create a new clip project
    CREATE_CLIP_RESPONSE=$(curl -s -X POST \
      "${API_BASE}/clips" \
      -H "Authorization: Bearer ${JWT_TOKEN}" \
      -H "Content-Type: application/json" \
      -d '{
        "title": "Test Collaboration Project",
        "srtContent": "1\n00:00:00,000 --> 00:00:05,000\nThis is a test subtitle for collaboration testing.\n\n2\n00:00:05,000 --> 00:00:10,000\nWe are testing invitation features.",
        "videoUrl": "https://example.com/test-video.mp4"
      }')
    
    print_response "$CREATE_CLIP_RESPONSE"
    
    CLIP_ID=$(echo "$CREATE_CLIP_RESPONSE" | jq -r '.id // empty' 2>/dev/null)
    
    if [ -z "$CLIP_ID" ] || [ "$CLIP_ID" = "null" ]; then
        print_error "Failed to create or find a clip project. Cannot continue with collaboration tests."
        exit 1
    fi
fi

print_success "Using Clip ID: $CLIP_ID"

# ==============================================================================
# 2. TEST SINGLE COLLABORATOR INVITATION
# ==============================================================================

print_header "2. SINGLE COLLABORATOR INVITATION TEST"

print_step "Sending invitation to $INVITE_EMAIL_1..."
INVITE_RESPONSE=$(curl -s -X POST \
  "${API_BASE}/clips/${CLIP_ID}/collaborators/invite" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"${INVITE_EMAIL_1}\",
    \"message\": \"Hey! Would you like to collaborate on this awesome clip project? This is a test invitation from the automated test suite.\"
  }")

print_response "$INVITE_RESPONSE"

# Check if invitation was successful
if echo "$INVITE_RESPONSE" | jq -e '.success' >/dev/null 2>&1; then
    print_success "Invitation sent successfully to $INVITE_EMAIL_1"
    INVITATION_ID=$(echo "$INVITE_RESPONSE" | jq -r '.invitationId')
    print_success "Invitation ID: $INVITATION_ID"
else
    print_error "Failed to send invitation to $INVITE_EMAIL_1"
fi

# Test duplicate invitation (should fail)
print_step "Testing duplicate invitation (should fail)..."
DUPLICATE_INVITE_RESPONSE=$(curl -s -X POST \
  "${API_BASE}/clips/${CLIP_ID}/collaborators/invite" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"${INVITE_EMAIL_1}\",
    \"message\": \"This should fail as duplicate\"
  }")

print_response "$DUPLICATE_INVITE_RESPONSE"

# Test invalid email
print_step "Testing invalid email invitation (should fail)..."
INVALID_EMAIL_RESPONSE=$(curl -s -X POST \
  "${API_BASE}/clips/${CLIP_ID}/collaborators/invite" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "invalid-email-format",
    "message": "This should fail due to invalid email"
  }')

print_response "$INVALID_EMAIL_RESPONSE"

# ==============================================================================
# 3. TEST BULK COLLABORATOR INVITATIONS
# ==============================================================================

print_header "3. BULK COLLABORATOR INVITATION TEST"

print_step "Sending bulk invitations..."
BULK_INVITE_RESPONSE=$(curl -s -X POST \
  "${API_BASE}/clips/${CLIP_ID}/collaborators/bulk-invite" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"emails\": [\"${INVITE_EMAIL_2}\", \"${INVITE_EMAIL_3}\", \"invalid-email\"],
    \"message\": \"Bulk invitation test - please join our collaboration project!\"
  }")

print_response "$BULK_INVITE_RESPONSE"

# ==============================================================================
# 4. TEST GETTING INVITATIONS LIST
# ==============================================================================

print_header "4. INVITATIONS LIST TEST"

print_step "Getting all invitations for the project..."
INVITATIONS_RESPONSE=$(curl -s -X GET \
  "${API_BASE}/clips/${CLIP_ID}/invitations" \
  -H "Authorization: Bearer ${JWT_TOKEN}")

print_response "$INVITATIONS_RESPONSE"

# Extract invitation token for testing invitation response
INVITATION_TOKEN=$(echo "$INVITATIONS_RESPONSE" | jq -r '.invitations[0].token // empty' 2>/dev/null)
if [ -n "$INVITATION_TOKEN" ] && [ "$INVITATION_TOKEN" != "null" ]; then
    print_success "Found invitation token for testing: ${INVITATION_TOKEN:0:20}..."
fi

# ==============================================================================
# 5. TEST GETTING COLLABORATORS LIST
# ==============================================================================

print_header "5. COLLABORATORS LIST TEST"

print_step "Getting all collaborators for the project..."
COLLABORATORS_RESPONSE=$(curl -s -X GET \
  "${API_BASE}/clips/${CLIP_ID}/collaborators" \
  -H "Authorization: Bearer ${JWT_TOKEN}")

print_response "$COLLABORATORS_RESPONSE"

# ==============================================================================
# 6. TEST INVITATION RESPONSE FLOW
# ==============================================================================

print_header "6. INVITATION RESPONSE TEST"

if [ -n "$INVITATION_TOKEN" ] && [ "$INVITATION_TOKEN" != "null" ]; then
    print_step "Testing invitation acceptance page..."
    INVITATION_PAGE_RESPONSE=$(curl -s -X GET \
      "${API_BASE}/invitations/accept?token=${INVITATION_TOKEN}")
    
    print_response "$INVITATION_PAGE_RESPONSE"
    
    print_step "Testing invitation decline..."
    DECLINE_RESPONSE=$(curl -s -X POST \
      "${API_BASE}/invitations/respond" \
      -H "Content-Type: application/json" \
      -d "{
        \"token\": \"${INVITATION_TOKEN}\",
        \"response\": \"decline\"
      }")
    
    print_response "$DECLINE_RESPONSE"
    
    # Test invalid token
    print_step "Testing invalid invitation token (should fail)..."
    INVALID_TOKEN_RESPONSE=$(curl -s -X POST \
      "${API_BASE}/invitations/respond" \
      -H "Content-Type: application/json" \
      -d '{
        "token": "invalid-token-12345",
        "response": "accept"
      }')
    
    print_response "$INVALID_TOKEN_RESPONSE"
else
    print_error "No invitation token available for testing invitation response"
fi

# ==============================================================================
# 7. TEST COLLABORATOR REMOVAL
# ==============================================================================

print_header "7. COLLABORATOR REMOVAL TEST"

# First, let's get the current collaborators to see if we have any to remove
print_step "Getting current collaborators before removal test..."
CURRENT_COLLABORATORS=$(curl -s -X GET \
  "${API_BASE}/clips/${CLIP_ID}/collaborators" \
  -H "Authorization: Bearer ${JWT_TOKEN}")

print_response "$CURRENT_COLLABORATORS"

# Try to remove a non-existent collaborator (should fail gracefully)
print_step "Testing removal of non-existent collaborator (should fail)..."
REMOVE_FAKE_RESPONSE=$(curl -s -X DELETE \
  "${API_BASE}/clips/${CLIP_ID}/collaborators" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "507f1f77bcf86cd799439011"
  }')

print_response "$REMOVE_FAKE_RESPONSE"

# ==============================================================================
# 8. TEST AUTHENTICATION AND AUTHORIZATION
# ==============================================================================

print_header "8. AUTHENTICATION & AUTHORIZATION TEST"

print_step "Testing access without authentication (should fail)..."
NO_AUTH_RESPONSE=$(curl -s -X GET \
  "${API_BASE}/clips/${CLIP_ID}/collaborators")

print_response "$NO_AUTH_RESPONSE"

print_step "Testing access with invalid JWT (should fail)..."
INVALID_JWT_RESPONSE=$(curl -s -X GET \
  "${API_BASE}/clips/${CLIP_ID}/collaborators" \
  -H "Authorization: Bearer invalid.jwt.token")

print_response "$INVALID_JWT_RESPONSE"

# Test access to non-existent clip
print_step "Testing access to non-existent clip (should fail)..."
NONEXISTENT_CLIP_RESPONSE=$(curl -s -X GET \
  "${API_BASE}/clips/507f1f77bcf86cd799439011/collaborators" \
  -H "Authorization: Bearer ${JWT_TOKEN}")

print_response "$NONEXISTENT_CLIP_RESPONSE"

# ==============================================================================
# 9. TEST EDGE CASES
# ==============================================================================

print_header "9. EDGE CASES TEST"

print_step "Testing invitation with empty email (should fail)..."
EMPTY_EMAIL_RESPONSE=$(curl -s -X POST \
  "${API_BASE}/clips/${CLIP_ID}/collaborators/invite" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "",
    "message": "This should fail"
  }')

print_response "$EMPTY_EMAIL_RESPONSE"

print_step "Testing invitation without required fields (should fail)..."
NO_EMAIL_RESPONSE=$(curl -s -X POST \
  "${API_BASE}/clips/${CLIP_ID}/collaborators/invite" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "This should fail - no email provided"
  }')

print_response "$NO_EMAIL_RESPONSE"

print_step "Testing bulk invitation with empty array (should fail)..."
EMPTY_BULK_RESPONSE=$(curl -s -X POST \
  "${API_BASE}/clips/${CLIP_ID}/collaborators/bulk-invite" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "emails": [],
    "message": "This should fail - empty emails array"
  }')

print_response "$EMPTY_BULK_RESPONSE"

# ==============================================================================
# 10. FINAL STATUS CHECK
# ==============================================================================

print_header "10. FINAL STATUS CHECK"

print_step "Final check - Getting updated invitations list..."
FINAL_INVITATIONS=$(curl -s -X GET \
  "${API_BASE}/clips/${CLIP_ID}/invitations" \
  -H "Authorization: Bearer ${JWT_TOKEN}")

print_response "$FINAL_INVITATIONS"

print_step "Final check - Getting updated collaborators list..."
FINAL_COLLABORATORS=$(curl -s -X GET \
  "${API_BASE}/clips/${CLIP_ID}/collaborators" \
  -H "Authorization: Bearer ${JWT_TOKEN}")

print_response "$FINAL_COLLABORATORS"

# ==============================================================================
# SUMMARY
# ==============================================================================

print_header "TEST SUMMARY"

echo -e "${BLUE}Test Completed!${NC}"
echo ""
echo "This script tested the following features:"
echo "✓ Single collaborator invitation"
echo "✓ Bulk collaborator invitations"
echo "✓ Invitation listing"
echo "✓ Collaborator listing"
echo "✓ Invitation response flow"
echo "✓ Collaborator removal"
echo "✓ Authentication and authorization"
echo "✓ Edge cases and error handling"
echo ""
echo "Key Test Data:"
echo "- Clip ID: $CLIP_ID"
echo "- Test User Email: iamsahilshukla@gmail.com"
echo "- Test User ID: 68b54a56bfcad65bf230868e"
echo ""
echo -e "${YELLOW}Note: This test script sends real invitations to test email addresses.${NC}"
echo -e "${YELLOW}Make sure to check your email service logs for delivery status.${NC}"
echo ""
echo -e "${GREEN}All tests have been executed. Check the responses above for any errors.${NC}"
