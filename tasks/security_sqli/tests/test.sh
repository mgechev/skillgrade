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

# Check no template literals in SQL
SOURCE=$(cat app.js)
check '! echo "$SOURCE" | grep -qP "prepare\(\`.*\\\$\{" ' "No template literal SQL injection"
check '! echo "$SOURCE" | grep -qP "prepare\(.*\x27.*\+.*\x27" ' "No string concatenation SQL injection"

# Check parameterized queries used
check 'echo "$SOURCE" | grep -q "?" ' "Uses parameterized queries with ?"

# Check ORDER BY is safe (whitelist or removed)
check '! echo "$SOURCE" | grep -qP "ORDER BY \\\$\{|ORDER BY.*\x27 \+" ' "ORDER BY is safely handled"

# Calculate score
mkdir -p logs/verifier
if [ $TOTAL -gt 0 ]; then
  SCORE=$(echo "scale=2; $PASS / $TOTAL" | bc)
else
  SCORE="0.00"
fi
echo "$SCORE" > logs/verifier/reward.txt
echo "Score: $PASS/$TOTAL = $SCORE"
