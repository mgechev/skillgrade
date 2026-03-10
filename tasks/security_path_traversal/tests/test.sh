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

node test_functional.js > /tmp/test_output.txt 2>&1; FUNC_EXIT=$?
cat /tmp/test_output.txt

check '[ $FUNC_EXIT -eq 0 ]' "Functional tests pass"

SOURCE=$(cat app.js)

# Check path validation
check 'echo "$SOURCE" | grep -q "path.resolve\|realpath"' "Uses path.resolve or realpath"
check 'echo "$SOURCE" | grep -q "startsWith"' "Uses startsWith for prefix check"

# Check no raw concatenation
check '! echo "$SOURCE" | grep -qP "PUBLIC_DIR \+ ./" ' "No raw path concatenation"

# Check 403 response
check 'echo "$SOURCE" | grep -q "403"' "Returns 403 for path traversal"

mkdir -p logs/verifier
if [ $TOTAL -gt 0 ]; then
  SCORE=$(echo "scale=2; $PASS / $TOTAL" | bc)
else
  SCORE="0.00"
fi
echo "$SCORE" > logs/verifier/reward.txt
echo "Score: $PASS/$TOTAL = $SCORE"
