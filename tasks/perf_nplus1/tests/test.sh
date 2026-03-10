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

node test_correctness.js > /tmp/test_output.txt 2>&1; FUNC_EXIT=$?
cat /tmp/test_output.txt
check '[ $FUNC_EXIT -eq 0 ]' "All correctness tests pass"

SOURCE=$(cat app.js)

# Check that N+1 patterns are removed
# Count queries inside for/forEach loops
LOOP_QUERIES=$(echo "$SOURCE" | grep -cP "for.*\{" || true)
PREPARE_IN_FUNC=$(echo "$SOURCE" | grep -c "db.prepare" || true)

# Should have fewer prepare calls (JOINs reduce query count)
check '[ "$PREPARE_IN_FUNC" -le 6 ]' "Reduced number of db.prepare calls (was 8+)"

# Should use JOIN or WHERE IN
check 'echo "$SOURCE" | grep -qiE "JOIN|WHERE.*IN\s*\("' "Uses JOIN or WHERE IN clause"

# Should not have prepare inside a for loop
# Simple heuristic: check if there's a pattern of for...prepare on nearby lines
LOOP_PREPARE=$(echo "$SOURCE" | awk '/for\s*\(|for\s*\(.*of|forEach/{found=1} found && /db\.prepare/{print; found=0}' | wc -l | tr -d ' ')
check '[ "$LOOP_PREPARE" -eq 0 ]' "No db.prepare inside loops"

mkdir -p logs/verifier
if [ $TOTAL -gt 0 ]; then
  SCORE=$(echo "scale=2; $PASS / $TOTAL" | bc)
else
  SCORE="0.00"
fi
echo "$SCORE" > logs/verifier/reward.txt
echo "Score: $PASS/$TOTAL = $SCORE"
