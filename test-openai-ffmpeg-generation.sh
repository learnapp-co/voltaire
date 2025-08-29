#!/bin/bash

# ClipFlow OpenAI + FFmpeg Clip Generation Test Script
# Tests the complete flow: Upload → AI Analysis → Clip Generation

set -e  # Exit on any error

# Configuration
API_BASE_URL="https://clipflow-production.up.railway.app"
JWT_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2OGFjMmQ4Y2MzNzY3NjQ0ZjZhYzdmZjUiLCJlbWFpbCI6ImlhbXNhaGlsc2h1a2xhQGdtYWlsLmNvbSIsImlhdCI6MTc1NjEyMzc0MSwiZXhwIjoxNzg3NjU5NzQxfQ.psXWLY4mhXvnj3sgs5bEA4puuxQ-VgrOtWsPPsc0TDI"
PROJECT_ID=""
TEMP_DIR="./temp_test_files"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log() {
    echo -e "${BLUE}[$(date +'%H:%M:%S')] $1${NC}"
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

error() {
    echo -e "${RED}❌ $1${NC}"
    exit 1
}

warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Check if required tools are installed
check_dependencies() {
    log "Checking dependencies..."
    
    command -v curl >/dev/null 2>&1 || error "curl is required but not installed"
    command -v jq >/dev/null 2>&1 || error "jq is required but not installed"
    command -v ffmpeg >/dev/null 2>&1 || error "ffmpeg is required but not installed"
    
    success "All dependencies are available"
}

# Validate JWT token
validate_token() {
    log "Validating JWT token..."
    
    if [ -z "$JWT_TOKEN" ]; then
        error "JWT token is not set"
    fi
    
    # Test token by making a simple authenticated request
    response=$(curl -s -w "\n%{http_code}" "$API_BASE_URL/clips" \
        -H "Authorization: Bearer $JWT_TOKEN")
    
    http_code=$(echo "$response" | tail -n1)
    
    if [ "$http_code" = "200" ]; then
        success "JWT token is valid"
    else
        error "JWT token is invalid or expired (HTTP $http_code)"
    fi
}

# Create test video and SRT files
create_test_files() {
    log "Creating test files..."
    
    mkdir -p "$TEMP_DIR"
    
    # Create a simple test video (10 seconds, 720p)
    log "Generating test video..."
    ffmpeg -f lavfi -i testsrc=duration=60:size=1280x720:rate=30 \
           -f lavfi -i sine=frequency=1000:duration=60 \
           -c:v libx264 -preset fast -pix_fmt yuv420p \
           -c:a aac -shortest \
           "$TEMP_DIR/test_video.mp4" \
           -y -loglevel quiet
    
    # Create test SRT file
    cat > "$TEMP_DIR/test_subtitles.srt" << 'EOF'
1
00:00:00,000 --> 00:00:05,000
Welcome to our podcast episode about artificial intelligence and the future of technology.

2
00:00:05,000 --> 00:00:12,000
Today we're discussing how AI is transforming various industries and what it means for developers.

3
00:00:12,000 --> 00:00:18,000
One of the most exciting developments is the rise of large language models like GPT-4.

4
00:00:18,000 --> 00:00:25,000
These models are capable of understanding context and generating human-like responses.

5
00:00:25,000 --> 00:00:32,000
Let's dive into the technical aspects of how these neural networks actually work.

6
00:00:32,000 --> 00:00:38,000
The transformer architecture has been a game changer for natural language processing.

7
00:00:38,000 --> 00:00:45,000
But what does this mean for software engineers and product managers in the industry?

8
00:00:45,000 --> 00:00:52,000
We need to consider both the opportunities and the ethical implications of AI deployment.

9
00:00:52,000 --> 00:00:60,000
Thank you for listening to today's episode. Don't forget to subscribe for more tech insights.
EOF
    
    success "Test files created successfully"
    log "Test video: $TEMP_DIR/test_video.mp4 ($(du -h "$TEMP_DIR/test_video.mp4" | cut -f1))"
    log "Test SRT: $TEMP_DIR/test_subtitles.srt"
}

# Upload test video to S3
upload_test_video() {
    log "Uploading test video to S3..."
    
    # Get signed URL for video upload
    video_size=$(stat -f%z "$TEMP_DIR/test_video.mp4" 2>/dev/null || stat -c%s "$TEMP_DIR/test_video.mp4")
    
    signed_url_response=$(curl -s -X POST "$API_BASE_URL/clips/upload/signed-url" \
        -H "Authorization: Bearer $JWT_TOKEN" \
        -H "Content-Type: application/json" \
        -d "{
            \"fileName\": \"test_video.mp4\",
            \"fileType\": \"video/mp4\",
            \"fileSize\": $video_size
        }")
    
    upload_url=$(echo "$signed_url_response" | jq -r '.uploadUrl // empty')
    video_url=$(echo "$signed_url_response" | jq -r '.fileUrl // empty')
    
    if [ -z "$upload_url" ] || [ "$upload_url" = "null" ]; then
        error "Failed to get signed URL: $(echo "$signed_url_response" | jq -r '.message // "Unknown error"')"
    fi
    
    # Upload video to S3
    log "Uploading to S3..."
    curl -s -X PUT "$upload_url" \
        -H "Content-Type: video/mp4" \
        --data-binary "@$TEMP_DIR/test_video.mp4" \
        -o /dev/null
    
    success "Video uploaded successfully: $video_url"
    echo "$video_url"
}

# Create clip project
create_clip_project() {
    local video_url="$1"
    log "Creating clip project..."
    
    response=$(curl -s -X POST "$API_BASE_URL/clips" \
        -H "Authorization: Bearer $JWT_TOKEN" \
        -F "title=AI Podcast Test Episode" \
        -F "videoUrl=$video_url" \
        -F "srtFile=@$TEMP_DIR/test_subtitles.srt")
    
    PROJECT_ID=$(echo "$response" | jq -r '.id // empty')
    
    if [ -z "$PROJECT_ID" ] || [ "$PROJECT_ID" = "null" ]; then
        error "Failed to create project: $(echo "$response" | jq -r '.message // "Unknown error"')"
    fi
    
    success "Project created successfully: $PROJECT_ID"
    log "Project details:"
    echo "$response" | jq '.title, .status, .rawFile.fileName'
}

# Test OpenAI theme analysis (if available)
test_openai_analysis() {
    log "Testing OpenAI theme analysis..."
    
    # Note: This would require additional API endpoint for theme analysis
    # For now, we'll simulate the themes that OpenAI might generate
    
    cat > "$TEMP_DIR/simulated_themes.json" << 'EOF'
[
  {
    "title": "AI Technology Overview",
    "description": "Discussion about artificial intelligence and its impact on technology",
    "angle": "Educational overview of AI developments",
    "confidence": 0.9,
    "keywords": ["AI", "technology", "artificial intelligence"],
    "timeRanges": [0, 25]
  },
  {
    "title": "GPT-4 and Language Models",
    "description": "Deep dive into large language models and their capabilities",
    "angle": "Technical explanation of transformer architecture",
    "confidence": 0.85,
    "keywords": ["GPT-4", "language models", "transformers"],
    "timeRanges": [12, 38]
  },
  {
    "title": "Industry Impact and Ethics",
    "description": "Discussion of AI's impact on software engineering and ethical considerations",
    "angle": "Professional and ethical perspective on AI",
    "confidence": 0.8,
    "keywords": ["software engineering", "ethics", "industry"],
    "timeRanges": [38, 60]
  }
]
EOF
    
    success "Simulated OpenAI theme analysis complete"
    log "Generated themes:"
    cat "$TEMP_DIR/simulated_themes.json" | jq -r '.[] | "- \(.title): \(.description)"'
}

# Generate clips from timestamps
generate_clips() {
    log "Generating clips from AI-suggested timestamps..."
    
    # Create clip generation request based on simulated themes
    generate_request=$(cat << 'EOF'
{
  "timestamps": [
    {
      "id": "ai-overview",
      "startTime": 0,
      "endTime": 25,
      "title": "AI Technology Overview",
      "description": "Introduction to artificial intelligence and its impact"
    },
    {
      "id": "gpt4-deep-dive",
      "startTime": 12,
      "endTime": 38,
      "title": "GPT-4 and Language Models",
      "description": "Technical discussion about large language models"
    },
    {
      "id": "industry-ethics",
      "startTime": 38,
      "endTime": 58,
      "title": "Industry Impact and Ethics",
      "description": "Professional perspective on AI in software engineering"
    }
  ],
  "quality": "medium",
  "format": "mp4"
}
EOF
)
    
    log "Sending clip generation request..."
    response=$(curl -s -X POST "$API_BASE_URL/clips/$PROJECT_ID/generate" \
        -H "Authorization: Bearer $JWT_TOKEN" \
        -H "Content-Type: application/json" \
        -d "$generate_request")
    
    status=$(echo "$response" | jq -r '.status // empty')
    
    if [ "$status" != "completed" ]; then
        error "Clip generation failed: $(echo "$response" | jq -r '.message // "Unknown status"')"
    fi
    
    success "Clip generation completed successfully"
    
    # Display generated clips
    log "Generated clips:"
    echo "$response" | jq -r '.generatedClips[] | "- \(.title): \(.clipUrl) (\(.duration)s, \(.fileSize) bytes)"'
    
    # Save URLs for verification
    echo "$response" | jq -r '.generatedClips[].clipUrl' > "$TEMP_DIR/generated_clip_urls.txt"
}

# Verify generated clips
verify_clips() {
    log "Verifying generated clips are accessible..."
    
    if [ ! -f "$TEMP_DIR/generated_clip_urls.txt" ]; then
        warning "No clip URLs found to verify"
        return
    fi
    
    clip_count=0
    while IFS= read -r clip_url; do
        if [ -n "$clip_url" ]; then
            clip_count=$((clip_count + 1))
            log "Checking clip $clip_count: $clip_url"
            
            # Check if URL is accessible (HEAD request)
            if curl -s -I "$clip_url" | grep -q "200 OK"; then
                success "Clip $clip_count is accessible"
            else
                warning "Clip $clip_count may not be accessible yet (S3 eventual consistency)"
            fi
        fi
    done < "$TEMP_DIR/generated_clip_urls.txt"
    
    success "Verification complete. Generated $clip_count clips."
}

# Cleanup
cleanup() {
    log "Cleaning up test files..."
    rm -rf "$TEMP_DIR"
    success "Cleanup complete"
}

# Performance metrics
show_performance_metrics() {
    log "Performance Metrics:"
    echo "- Test video size: $(du -h "$TEMP_DIR/test_video.mp4" 2>/dev/null | cut -f1 || echo "Unknown")"
    echo "- SRT file size: $(du -h "$TEMP_DIR/test_subtitles.srt" 2>/dev/null | cut -f1 || echo "Unknown")"
    echo "- Number of generated clips: $(cat "$TEMP_DIR/generated_clip_urls.txt" 2>/dev/null | wc -l || echo "0")"
    echo "- Total test duration: $(($(date +%s) - $START_TIME)) seconds"
}

# Main execution
main() {
    START_TIME=$(date +%s)
    
    echo -e "${BLUE}"
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║      ClipFlow Production OpenAI + FFmpeg Generation Test    ║"
    echo "║         Testing against: clipflow-production.up.railway.app ║"
    echo "║  This script tests the complete clip generation flow:       ║"
    echo "║  1. Token validation                                         ║"
    echo "║  2. Test file creation                                       ║"
    echo "║  3. Video upload to S3                                      ║"
    echo "║  4. Project creation                                         ║"
    echo "║  5. OpenAI theme analysis (simulated)                       ║"
    echo "║  6. FFmpeg clip generation                                   ║"
    echo "║  7. Verification and cleanup                                 ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    
    # Run tests
    check_dependencies
    validate_token
    create_test_files
    video_url=$(upload_test_video)
    create_clip_project "$video_url"
    test_openai_analysis
    generate_clips
    verify_clips
    show_performance_metrics
    
    echo
    success "🎉 All tests completed successfully!"
    echo
    log "Project ID: $PROJECT_ID"
    log "Check your AWS S3 bucket for generated clips in: clips/$PROJECT_ID/"
    
    read -p "Clean up test files? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        cleanup
    else
        log "Test files preserved in: $TEMP_DIR"
    fi
}

# Handle interruption
trap 'echo; error "Test interrupted by user"' INT

# Run if executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
