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
check '[ $FUNC_EXIT -eq 0 ]' "All formatting tests pass"

SOURCE=$(cat app.js)

check '! echo "$SOURCE" | grep -q "var "' "No var usage"
check 'echo "$SOURCE" | grep -q "=>"' "Uses arrow functions"
check 'echo "$SOURCE" | grep -q "\`"' "Uses template literals"
check '! echo "$SOURCE" | grep -qP "\t"' "No tab indentation"
check 'node -e "require(\"./app\")"' "Module loads correctly"

mkdir -p logs/verifier
if [ $TOTAL -gt 0 ]; then
  SCORE=$(echo "scale=2; $PASS / $TOTAL" | bc)
else
  SCORE="0.00"
fi
echo "$SCORE" > logs/verifier/reward.txt
echo "Score: $PASS/$TOTAL = $SCORE"
