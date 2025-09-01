#!/bin/bash

# Test Brevo Email Integration
# This script helps verify that the Brevo email service is working correctly

# =============================================================================
# CONFIGURATION - UPDATE THESE VALUES
# =============================================================================
BASE_URL="http://localhost:3000"
JWT_TOKEN="your-jwt-token-here"  # Replace with a valid JWT token
TEST_EMAIL="your-email@example.com"  # Replace with your email address

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Helper function to print section headers
print_section() {
    echo -e "\n${BLUE}=============================================================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}=============================================================================${NC}\n"
}

# Helper function to execute curl with pretty output
execute_curl() {
    local description="$1"
    shift
    echo -e "${GREEN}➡️  $description${NC}"
    echo "Command: curl $*"
    echo "Response:"
    curl -s "$@" | jq '.' 2>/dev/null || curl -s "$@"
    echo -e "\n"
}

print_section "BREVO EMAIL SERVICE TESTS"

echo -e "${YELLOW}📧 Testing Brevo email integration${NC}"
echo "Make sure your .env file has:"
echo "- BREVO_API_KEY=xkeysib-your-brevo-api-key"
echo "- EMAIL_FROM=your-verified-sender@yourdomain.com"
echo "- EMAIL_FROM_NAME=ClipFlow"
echo ""

print_section "1. TEST EMAIL ENDPOINT"

echo -e "${YELLOW}🧪 Test 1: Send test email${NC}"
execute_curl "Send test email via Brevo" \
    -X POST \
    -H "Authorization: Bearer $JWT_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"to\": \"$TEST_EMAIL\"}" \
    "$BASE_URL/email/test"

print_section "2. AUTHENTICATION FLOW EMAILS"

echo -e "${YELLOW}🔐 Test 2: Password reset email${NC}"
execute_curl "Test password reset email" \
    -X POST \
    -H "Authorization: Bearer $JWT_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
        \"email\": \"$TEST_EMAIL\",
        \"firstName\": \"Test\",
        \"resetToken\": \"test-reset-token-123\"
    }" \
    "$BASE_URL/email/password-reset"

echo -e "${YELLOW}👋 Test 3: Welcome email${NC}"
execute_curl "Test welcome email" \
    -X POST \
    -H "Authorization: Bearer $JWT_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
        \"email\": \"$TEST_EMAIL\",
        \"firstName\": \"Test\",
        \"temporaryPassword\": \"TempPass123!\"
    }" \
    "$BASE_URL/email/welcome"

echo -e "${YELLOW}🤝 Test 4: Collaborator invitation email${NC}"
execute_curl "Test collaborator invitation email" \
    -X POST \
    -H "Authorization: Bearer $JWT_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
        \"email\": \"$TEST_EMAIL\",
        \"inviterFirstName\": \"John\",
        \"inviterLastName\": \"Doe\",
        \"projectTitle\": \"Test Project\",
        \"message\": \"Please join our collaboration!\",
        \"invitationToken\": \"test-invitation-token-456\",
        \"needsSignup\": true
    }" \
    "$BASE_URL/email/collaborator-invitation"

print_section "3. ERROR HANDLING TESTS"

echo -e "${YELLOW}❌ Test 5: Missing authentication${NC}"
execute_curl "Test missing authentication" \
    -X POST \
    -H "Content-Type: application/json" \
    -d "{\"to\": \"$TEST_EMAIL\"}" \
    "$BASE_URL/email/test"

echo -e "${YELLOW}❌ Test 6: Invalid email format${NC}"
execute_curl "Test invalid email format" \
    -X POST \
    -H "Authorization: Bearer $JWT_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"to\": \"invalid-email-format\"}" \
    "$BASE_URL/email/test"

print_section "TESTING COMPLETE"

echo -e "${GREEN}✅ All Brevo email tests completed!${NC}"
echo ""
echo -e "${YELLOW}📝 Next steps:${NC}"
echo "1. Check your email inbox at $TEST_EMAIL for test emails"
echo "2. Verify that all emails are delivered properly"
echo "3. Check email formatting and templates"
echo "4. Monitor Brevo dashboard for delivery statistics"
echo ""
echo -e "${BLUE}🔧 Configuration checklist:${NC}"
echo "□ BREVO_API_KEY is set and valid"
echo "□ EMAIL_FROM is verified in Brevo account"
echo "□ EMAIL_FROM_NAME is set appropriately"
echo "□ FRONTEND_URL is correct for links in emails"
echo ""
echo -e "${BLUE}🐛 If emails fail to send:${NC}"
echo "1. Check server logs for detailed error messages"
echo "2. Verify Brevo API key is correct"
echo "3. Ensure sender email is verified in Brevo"
echo "4. Check Brevo account for any sending limits or restrictions"
echo ""
echo -e "${BLUE}📊 Monitor sending in Brevo:${NC}"
echo "1. Log in to your Brevo account"
echo "2. Go to Transactional > Statistics"
echo "3. Check delivery rates and any bounces/complaints"

# Make script executable
chmod +x "$0"
