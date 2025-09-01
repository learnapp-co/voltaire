#!/bin/bash

# Quick Invitation Test Script for ClipFlow
# A simplified version for quick testing of core invitation features

# Configuration
JWT_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2OGI1NGE1NmJmY2FkNjViZjIzMDg2OGUiLCJlbWFpbCI6ImlhbXNhaGlsc2h1a2xhQGdtYWlsLmNvbSIsImlhdCI6MTc1NjcxMTY5NiwiZXhwIjoxNzg4MjQ3Njk2fQ.-dOlW6UTNi4MJwRE8vwZtv-JYJ-wUrljXux0NyQ0xcw"
BASE_URL="http://localhost:3000"
API_BASE="${BASE_URL}"

# Test configuration
INVITE_EMAIL="test-collaborator@example.com"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${YELLOW}🚀 Quick ClipFlow Invitation Test${NC}"
echo "Testing with user: iamsahilshukla@gmail.com"

# Get first available clip
echo -e "\n${YELLOW}1. Getting available clips...${NC}"
CLIPS_RESPONSE=$(curl -s -X GET \
  "${API_BASE}/clips" \
  -H "Authorization: Bearer ${JWT_TOKEN}")

CLIP_ID=$(echo "$CLIPS_RESPONSE" | jq -r '.clips[0].id // empty' 2>/dev/null)

if [ -z "$CLIP_ID" ] || [ "$CLIP_ID" = "null" ]; then
    echo -e "${RED}❌ No clips found. Please create a clip project first.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Found clip: $CLIP_ID${NC}"

# Send invitation
echo -e "\n${YELLOW}2. Sending invitation to $INVITE_EMAIL...${NC}"
INVITE_RESPONSE=$(curl -s -X POST \
  "${API_BASE}/clips/${CLIP_ID}/collaborators/invite" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"${INVITE_EMAIL}\",
    \"message\": \"Quick test invitation from automation script\"
  }")

echo "$INVITE_RESPONSE" | jq '.'

if echo "$INVITE_RESPONSE" | jq -e '.success' >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Invitation sent successfully!${NC}"
else
    echo -e "${RED}❌ Failed to send invitation${NC}"
fi

# Get invitations
echo -e "\n${YELLOW}3. Getting invitations list...${NC}"
INVITATIONS_RESPONSE=$(curl -s -X GET \
  "${API_BASE}/clips/${CLIP_ID}/invitations" \
  -H "Authorization: Bearer ${JWT_TOKEN}")

echo "$INVITATIONS_RESPONSE" | jq '.'

# Get collaborators
echo -e "\n${YELLOW}4. Getting collaborators list...${NC}"
COLLABORATORS_RESPONSE=$(curl -s -X GET \
  "${API_BASE}/clips/${CLIP_ID}/collaborators" \
  -H "Authorization: Bearer ${JWT_TOKEN}")

echo "$COLLABORATORS_RESPONSE" | jq '.'

echo -e "\n${GREEN}✅ Quick test completed!${NC}"
echo -e "${YELLOW}💡 For comprehensive testing, run: ./test-invitation-collaboration.sh${NC}"
