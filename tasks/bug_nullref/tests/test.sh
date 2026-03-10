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

node test.js > /tmp/test_output.txt 2>&1; FUNC_EXIT=$?
cat /tmp/test_output.txt
check '[ $FUNC_EXIT -eq 0 ]' "All tests pass"

PASS_COUNT=$(grep -c "PASS:" /tmp/test_output.txt || true)
check '[ "$PASS_COUNT" -ge 15 ]' "At least 15 individual tests pass"

SOURCE=$(cat service.js)

# Check that null safety measures were added
check 'echo "$SOURCE" | grep -qE "\?\.|(\?\?)" ' "Uses optional chaining or nullish coalescing"

mkdir -p logs/verifier
if [ $TOTAL -gt 0 ]; then
  SCORE=$(echo "scale=2; $PASS / $TOTAL" | bc)
else
  SCORE="0.00"
fi
echo "$SCORE" > logs/verifier/reward.txt
echo "Score: $PASS/$TOTAL = $SCORE"
