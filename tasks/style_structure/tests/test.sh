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
check '[ $FUNC_EXIT -eq 0 ]' "All tests pass"

SOURCE=$(cat handler.js)

# Code was split into multiple functions
FUNC_COUNT=$(echo "$SOURCE" | grep -cE "^(function |const \w+ = \(|const \w+ = function)" || true)
check '[ "$FUNC_COUNT" -ge 4 ]' "At least 4 function definitions"

# Uses early returns
EARLY_RETURNS=$(echo "$SOURCE" | grep -c "return.*error\|return.*false\|return.*null" || true)
check '[ "$EARLY_RETURNS" -ge 2 ]' "Uses early returns"

# Module loads
check 'node -e "const m = require(\"./handler\"); m.processOrder({items:[{name:\"x\",price:10,quantity:1}],country:\"US\",state:\"CA\"})"' "Module works correctly"

mkdir -p logs/verifier
if [ $TOTAL -gt 0 ]; then
  SCORE=$(echo "scale=2; $PASS / $TOTAL" | bc)
else
  SCORE="0.00"
fi
echo "$SCORE" > logs/verifier/reward.txt
echo "Score: $PASS/$TOTAL = $SCORE"
