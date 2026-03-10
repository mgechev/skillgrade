#!/bin/bash
set -uo pipefail

PASS=0
TOTAL=0

check() {
  TOTAL=$((TOTAL + 1))
  if eval "$1"; then
    PASS=$((PASS + 1))
    echo "PASS: $2"
  else
    echo "FAIL: $2"
  fi
}

node test_check.js > /tmp/test_output.txt 2>&1; FUNC_EXIT=$?
cat /tmp/test_output.txt
check '[ $FUNC_EXIT -eq 0 ]' "All naming tests pass"

SOURCE=$(cat utils.js)

# No snake_case for non-constants
check '! echo "$SOURCE" | grep -qP "(?<!_)(function|const|let|var)\s+[a-z]+_[a-z]+" ' "No snake_case function/variable names"

# PascalCase class
check 'echo "$SOURCE" | grep -q "class UserManager"' "Class is PascalCase"

# UPPER_SNAKE_CASE constants
check 'echo "$SOURCE" | grep -q "MAX_RETRY_COUNT\|MAX_RETRIES"' "Constants are UPPER_SNAKE_CASE"

# Module still loadable
check 'node -e "require(\"./utils\")"' "Module loads successfully"

mkdir -p logs/verifier
if [ $TOTAL -gt 0 ]; then
  SCORE=$(echo "scale=2; $PASS / $TOTAL" | bc)
else
  SCORE="0.00"
fi
echo "$SCORE" > logs/verifier/reward.txt
echo "Score: $PASS/$TOTAL = $SCORE"
