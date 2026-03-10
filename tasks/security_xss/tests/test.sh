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

# Run functional tests
node test_functional.js > /tmp/test_output.txt 2>&1; FUNC_EXIT=$?
cat /tmp/test_output.txt

check '[ $FUNC_EXIT -eq 0 ]' "Functional tests pass"

SOURCE=$(cat app.js)

# Check escape function exists
check 'echo "$SOURCE" | grep -qiE "escapehtml|escape_html|sanitize|htmlencode"' "Has HTML escape function"

# Check escape function handles key characters
check 'echo "$SOURCE" | grep -q "&amp;"' "Escapes ampersand"
check 'echo "$SOURCE" | grep -q "&lt;"' "Escapes less-than"
check 'echo "$SOURCE" | grep -q "&gt;"' "Escapes greater-than"

# Calculate score
mkdir -p logs/verifier
if [ $TOTAL -gt 0 ]; then
  SCORE=$(echo "scale=2; $PASS / $TOTAL" | bc)
else
  SCORE="0.00"
fi
echo "$SCORE" > logs/verifier/reward.txt
echo "Score: $PASS/$TOTAL = $SCORE"
