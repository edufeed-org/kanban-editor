#!/bin/bash
# E2E Test Runner with CI Config Swap
# This script temporarily replaces static/config.json with static/config.ci.json
# during e2e tests and restores it afterward.

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

CONFIG_DIR="static"
CONFIG_FILE="${CONFIG_DIR}/config.json"
CI_CONFIG_FILE="${CONFIG_DIR}/config.ci.json"
BACKUP_FILE="${CONFIG_DIR}/config.json.backup"

# Function to restore config on exit
cleanup() {
  local exit_code=$?
  
  if [ -f "$BACKUP_FILE" ]; then
    echo -e "\n${BLUE}🔄 Restoring original config.json...${NC}"
    mv "$BACKUP_FILE" "$CONFIG_FILE"
    echo -e "${GREEN}✅ Original config.json restored${NC}"
  fi
  
  if [ $exit_code -ne 0 ]; then
    echo -e "${RED}❌ Tests failed with exit code: $exit_code${NC}"
  else
    echo -e "${GREEN}✅ Tests completed successfully${NC}"
  fi
  
  exit $exit_code
}

# Register cleanup function to run on script exit
trap cleanup EXIT INT TERM

# Check if nostr-relay is running on port 7000
echo -e "${BLUE}🔍 Checking for local nostr-relay on port 7000...${NC}"
if ! nc -z localhost 7000 2>/dev/null && ! lsof -i:7000 >/dev/null 2>&1 && ! ss -tuln 2>/dev/null | grep -q ":7000 "; then
  echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${RED}❌ ERROR: Nostr relay is not running on port 7000!${NC}"
  echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e ""
  echo -e "The E2E tests require a local nostr relay running on ${YELLOW}ws://localhost:7000${NC}"
  echo -e ""
  echo -e "To start the relay, run:"
  echo -e "  ${GREEN}docker compose up -d${NC}"
  echo -e ""
  echo -e "Then verify it's running with:"
  echo -e "  ${GREEN}docker compose ps${NC}"
  echo -e ""
  echo -e "Once the relay is running, try this command again."
  echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  
  # Unset trap to avoid cleanup on this error exit
  trap - EXIT INT TERM
  exit 1
fi
echo -e "${GREEN}✅ Nostr relay is running on port 7000${NC}"
echo ""

# Main script
echo -e "${YELLOW}⚠️  WARNING: E2E Test Config Swap${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "This script will temporarily replace:"
echo -e "  ${BLUE}${CONFIG_FILE}${NC}"
echo -e "with:"
echo -e "  ${BLUE}${CI_CONFIG_FILE}${NC}"
echo -e ""
echo -e "The original config will be restored automatically after the tests."
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Check if CI config exists
if [ ! -f "$CI_CONFIG_FILE" ]; then
  echo -e "${RED}❌ Error: ${CI_CONFIG_FILE} not found!${NC}"
  exit 1
fi

# Backup current config
if [ -f "$CONFIG_FILE" ]; then
  echo -e "${BLUE}📦 Backing up current config.json...${NC}"
  cp "$CONFIG_FILE" "$BACKUP_FILE"
  echo -e "${GREEN}✅ Backup created: ${BACKUP_FILE}${NC}"
else
  echo -e "${YELLOW}⚠️  No existing config.json found, skipping backup${NC}"
fi

# Copy CI config to config.json
echo -e "${BLUE}🔄 Copying config.ci.json to config.json...${NC}"
cp "$CI_CONFIG_FILE" "$CONFIG_FILE"
echo -e "${GREEN}✅ CI config activated${NC}"
echo ""

# Run e2e tests
echo -e "${BLUE}🧪 Running E2E tests...${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
playwright test "$@"

# Note: cleanup function will be called automatically due to trap
