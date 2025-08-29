#!/bin/bash

# Quick test runner - loads environment and runs tests

if [ -f ".env.test" ]; then
    source .env.test
    echo "Loaded test environment variables"
else
    echo "⚠️  .env.test not found. Please run ./setup-tests.sh first"
    exit 1
fi

echo "Select test to run:"
echo "1) Bash script (quick test)"
echo "2) Node.js script (detailed test)" 
echo "3) Node.js script with cleanup"
echo "4) Both tests"

read -p "Choice (1-4): " choice

case $choice in
    1)
        ./test-openai-ffmpeg-generation.sh
        ;;
    2)
        node test-openai-ffmpeg.js
        ;;
    3)
        node test-openai-ffmpeg.js --cleanup
        ;;
    4)
        echo "Running bash test first..."
        ./test-openai-ffmpeg-generation.sh
        echo -e "\n" 
        echo "Running Node.js test..."
        node test-openai-ffmpeg.js --cleanup
        ;;
    *)
        echo "Invalid choice"
        exit 1
        ;;
esac
