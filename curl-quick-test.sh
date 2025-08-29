#!/bin/bash

# =============================================================================
# ClipFlow API - Quick Test Script
# =============================================================================

BASE_URL="https://clipflow-production.up.railway.app"
ACCESS_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2OGFjMmQ4Y2MzNzY3NjQ0ZjZhYzdmZjUiLCJlbWFpbCI6ImlhbXNhaGlsc2h1a2xhQGdtYWlsLmNvbSIsImlhdCI6MTc1NjEyMzc0MSwiZXhwIjoxNzg3NjU5NzQxfQ.psXWLY4mhXvnj3sgs5bEA4puuxQ-VgrOtWsPPsc0TDI"

echo "🚀 ClipFlow API Production Quick Test"
echo "======================================"
echo "Testing against: https://clipflow-production.up.railway.app"
echo "Using provided JWT token: ${ACCESS_TOKEN:0:50}..."

# 1. Get user info
echo -e "\n1. Getting user info..."
curl -X GET "$BASE_URL/auth/me" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq '.'

# 2. Get projects
echo -e "\n2. Getting clip projects..."
curl -X GET "$BASE_URL/clips" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq '.'

echo -e "\n✅ Quick test completed!"
