#!/bin/bash

# ClipFlow Invitation Test Runner
# Simple wrapper script to run invitation and collaboration tests

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}=================================================="
echo "ClipFlow Invitation & Collaboration Test Runner"
echo -e "==================================================${NC}"

# Check if required tools are installed
echo -e "\n${YELLOW}Checking prerequisites...${NC}"

if ! command -v curl &> /dev/null; then
    echo -e "${RED}❌ curl is required but not installed${NC}"
    exit 1
fi

if ! command -v jq &> /dev/null; then
    echo -e "${RED}❌ jq is required but not installed${NC}"
    echo "Install with: brew install jq (macOS) or sudo apt-get install jq (Ubuntu)"
    exit 1
fi

echo -e "${GREEN}✅ Prerequisites satisfied${NC}"

# Check if server is running
echo -e "\n${YELLOW}Checking server status...${NC}"
SERVER_CHECK=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api || echo "000")

if [ "$SERVER_CHECK" = "000" ]; then
    echo -e "${RED}❌ ClipFlow server is not running at http://localhost:3000${NC}"
    echo "Please start your server first with: npm run start:dev"
    exit 1
elif [ "$SERVER_CHECK" = "404" ]; then
    echo -e "${GREEN}✅ Server is running${NC}"
else
    echo -e "${YELLOW}⚠️  Server responded with status: $SERVER_CHECK${NC}"
fi

# Show available test options
echo -e "\n${BLUE}Available Tests:${NC}"
echo "1. Quick Test (basic invitation flow)"
echo "2. Comprehensive Test (all features)"
echo "3. Both tests"

read -p "Select test to run (1-3): " choice

case $choice in
    1)
        echo -e "\n${YELLOW}Running Quick Test...${NC}"
        ./quick-invite-test.sh
        ;;
    2)
        echo -e "\n${YELLOW}Running Comprehensive Test...${NC}"
        ./test-invitation-collaboration.sh
        ;;
    3)
        echo -e "\n${YELLOW}Running Quick Test first...${NC}"
        ./quick-invite-test.sh
        
        echo -e "\n${YELLOW}Now running Comprehensive Test...${NC}"
        read -p "Press Enter to continue or Ctrl+C to stop..."
        ./test-invitation-collaboration.sh
        ;;
    *)
        echo -e "${RED}Invalid choice. Please run again and select 1, 2, or 3.${NC}"
        exit 1
        ;;
esac

echo -e "\n${GREEN}✅ Test execution completed!${NC}"
echo -e "${BLUE}Check the output above for test results and any errors.${NC}"
