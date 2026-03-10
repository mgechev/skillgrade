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

timeout 30 node test.js > /tmp/test_output.txt 2>&1; FUNC_EXIT=$?
cat /tmp/test_output.txt
check '[ $FUNC_EXIT -eq 0 ]' "All tests pass"

PASS_COUNT=$(grep -c "PASS:" /tmp/test_output.txt || true)
check '[ "$PASS_COUNT" -ge 8 ]' "At least 8 individual tests pass"

SOURCE=$(cat async-service.js)

# Check proper await usage
AWAIT_COUNT=$(echo "$SOURCE" | grep -c "await" || true)
check '[ "$AWAIT_COUNT" -ge 8 ]' "Sufficient await usage"

mkdir -p logs/verifier
if [ $TOTAL -gt 0 ]; then
  SCORE=$(echo "scale=2; $PASS / $TOTAL" | bc)
else
  SCORE="0.00"
fi
echo "$SCORE" > logs/verifier/reward.txt
echo "Score: $PASS/$TOTAL = $SCORE"
