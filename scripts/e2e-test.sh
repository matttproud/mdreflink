#!/bin/bash

# End-to-end test script for mdreflink that exercises a basic user journey with
# the built binary.

set -euo pipefail  # Exit on error, undefined vars, pipe failures

WORK_FLAG=false
while [[ $# -gt 0 ]]; do
  case $1 in
    -work)
      WORK_FLAG=true
      shift
      ;;
    -h|--help)
      echo "Usage: $0 [-work]"
      echo ""
      echo "Options:"
      echo "  -work        print the name of the temporary test directory and"
      echo "               do not delete it when exiting."
      echo "  -h, --help   show this help message"
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      echo "Use -h for help" >&2
      exit 1
      ;;
  esac
done

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

TEMP_DIR=""

cleanup() {
  if [[ -n "$TEMP_DIR" && -d "$TEMP_DIR" ]]; then
    if [[ "$WORK_FLAG" == "true" ]]; then
      echo -e "${YELLOW}Keeping temporary directory (due to -work flag): $TEMP_DIR${NC}"
    fi
  fi
}

trap cleanup EXIT

log() {
  echo -e "${GREEN}[E2E]${NC} $1"
}

error() {
  echo -e "${RED}[E2E ERROR]${NC} $1" >&2
  exit 1
}

run_binary() {
  local args="$1"
  local input="${2:-}"
  local expected_exit_code="${3:-0}"
  
  if [[ -n "$input" ]]; then
    echo "$input" | ./mdreflink $args
  else
    ./mdreflink $args
  fi
  
  local actual_exit_code=$?
  if [[ $actual_exit_code -ne $expected_exit_code ]]; then
    error "Expected exit code $expected_exit_code, got $actual_exit_code"
  fi
}

compare_output() {
  local actual_string="$1"
  local expected_string="$2"
  local test_name="$3"
  
  if [[ "$actual_string" != "$expected_string" ]]; then
    echo -e "${RED}Test '$test_name' failed:${NC}" >&2
    echo -e "${RED}Differences (- expected, + actual):${NC}" >&2
    local expected_file=$(mktemp)
    local actual_file=$(mktemp)
    echo "$expected_string" > "$expected_file"
    echo "$actual_string" > "$actual_file"
    diff -u "$expected_file" "$actual_file" || true
    rm -f "$expected_file" "$actual_file"
    exit 1
  fi
}

log "Starting end-to-end tests..."

log "Cleaning project..."
if ! (npm run clean 2>/dev/null || rm -rf dist); then
  error "Failed to clean project"
fi

log "Running unit tests..."
if ! npm test; then
  error "Unit tests failed"
fi

log "Building binary..."
if ! npm run build; then
  error "Build failed"
fi

if [[ ! -f "dist/index.js" ]]; then
  error "Binary not found at dist/index.js after build"
fi

log "Creating temporary test directory..."
TEMP_DIR=$(mktemp -d)
if [[ ! -d "$TEMP_DIR" ]]; then
  error "Failed to create temporary directory"
fi

if [[ "$WORK_FLAG" == "true" ]]; then
  echo -e "${YELLOW}Temporary test directory: $TEMP_DIR${NC}"
else
  log "Temporary directory: $TEMP_DIR"
fi

log "Copying binary to test directory..."
if ! cp dist/index.js "$TEMP_DIR/mdreflink"; then
  error "Failed to copy binary to temporary directory"
fi
if ! chmod +x "$TEMP_DIR/mdreflink"; then
  error "Failed to make binary executable"
fi

cd "$TEMP_DIR" || error "Failed to change to temporary directory"
log "Changed to temporary directory: $(pwd)"

log "Testing basic operation..."

cat > input.md << 'EOF'
---
title: Test Document
author: Test Author
---

# My Document

This document has [multiple](http://example.com) links and 
[some formatting](http://test.com) to test. Here's another
[link to content](http://content.com) for good measure.

## Section 2

More content with [existing][ref1] and [new links](http://new.com).

[ref1]: http://existing.com
EOF

cat > expected.md << 'EOF'
---
title: Test Document
author: Test Author
---

# My Document

This document has [multiple] links and
[some formatting] to test. Here's another
[link to content] for good measure.

[link to content]: http://content.com
[multiple]: http://example.com
[some formatting]: http://test.com

## Section 2

More content with [existing] and [new links].

[existing]: http://existing.com
[new links]: http://new.com
EOF

actual_output=$(run_binary "input.md")
expected_output=$(cat expected.md)
compare_output "$actual_output" "$expected_output" "basic operation"

log "All end-to-end tests passed! ✅"
exit 0
