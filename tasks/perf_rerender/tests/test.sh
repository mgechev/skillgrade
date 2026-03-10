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

node test_checks.js > /tmp/test_output.txt 2>&1; FUNC_EXIT=$?
cat /tmp/test_output.txt
check '[ $FUNC_EXIT -eq 0 ]' "All static analysis tests pass"

SOURCE=$(cat App.jsx)

# Verify memo usage
check 'echo "$SOURCE" | grep -qE "React\.memo|memo\("' "Uses React.memo"
check 'echo "$SOURCE" | grep -q "useMemo"' "Uses useMemo"
check 'echo "$SOURCE" | grep -q "useCallback"' "Uses useCallback"

# Verify StatsPanel or ChartPanel is wrapped with memo
check 'echo "$SOURCE" | grep -qE "memo\(.*StatsPanel|StatsPanel.*memo|memo\(.*ChartPanel|ChartPanel.*memo|memo\(.*UserCard|UserCard.*memo"' "At least one child component is memoized"

mkdir -p logs/verifier
if [ $TOTAL -gt 0 ]; then
  SCORE=$(echo "scale=2; $PASS / $TOTAL" | bc)
else
  SCORE="0.00"
fi
echo "$SCORE" > logs/verifier/reward.txt
echo "Score: $PASS/$TOTAL = $SCORE"
