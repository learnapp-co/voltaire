#!/bin/bash

# Quick test runner for production - tests against clipflow-production.up.railway.app

# Set production environment variables
export API_BASE_URL="https://clipflow-production.up.railway.app"
export JWT_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2OGFjMmQ4Y2MzNzY3NjQ0ZjZhYzdmZjUiLCJlbWFpbCI6ImlhbXNhaGlsc2h1a2xhQGdtYWlsLmNvbSIsImlhdCI6MTc1NjEyMzc0MSwiZXhwIjoxNzg3NjU5NzQxfQ.psXWLY4mhXvnj3sgs5bEA4puuxQ-VgrOtWsPPsc0TDI"

echo "🚀 ClipFlow Production Test Runner"
echo "Testing against: https://clipflow-production.up.railway.app"
echo ""

echo "Select test to run:"
echo "1) Full clip generation test (bash script)"
echo "2) Clip regeneration test" 
echo "3) Both tests"
echo "4) Quick curl test"

read -p "Choice (1-4): " choice

case $choice in
    1)
        echo "Running full clip generation test..."
        ./test-openai-ffmpeg-generation.sh
        ;;
    2)
        echo "Running clip regeneration test..."
        ./test-production-regeneration.sh
        ;;
    3)
        echo "Running full clip generation test first..."
        ./test-openai-ffmpeg-generation.sh
        echo -e "\n" 
        echo "Running regeneration test..."
        ./test-production-regeneration.sh
        ;;
    4)
        echo "Running quick curl test..."
        ./curl-quick-test.sh
        ;;
    *)
        echo "Invalid choice"
        exit 1
        ;;
esac

