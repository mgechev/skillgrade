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

# Correctness tests must pass
node test_correctness.js > /tmp/test_output.txt 2>&1; FUNC_EXIT=$?
cat /tmp/test_output.txt
check '[ $FUNC_EXIT -eq 0 ]' "All correctness tests pass"

SOURCE=$(cat utils.js)

# Check that nested loops are reduced
# findDuplicates should use Set or Map
check 'echo "$SOURCE" | grep -qE "new Set|new Map|Set\(|Map\("' "Uses Set or Map data structures"

# Should not have O(n²) patterns: nested for loops with same array
NESTED_LOOPS=$(echo "$SOURCE" | grep -c "for.*for" || true)
check '[ "$NESTED_LOOPS" -le 1 ]' "Reduced nested loop count"

# Check if includes() is removed from hot paths (was cause of O(n²))
INCLUDES_COUNT=$(echo "$SOURCE" | grep -c "\.includes(" || true)
check '[ "$INCLUDES_COUNT" -le 1 ]' "Removed .includes() from hot loops"

# Run benchmark and check timing
node bench.js > /tmp/bench_output.txt 2>&1; FUNC_EXIT=$?
cat /tmp/bench_output.txt

# Check that findDuplicates is under 100ms (was >1000ms for N=10000)
FIND_DUP_TIME=$(grep "findDuplicates:" /tmp/bench_output.txt | grep -oP '\d+' | tail -1)
check '[ "${FIND_DUP_TIME:-9999}" -lt 100 ]' "findDuplicates < 100ms"

mkdir -p logs/verifier
if [ $TOTAL -gt 0 ]; then
  SCORE=$(echo "scale=2; $PASS / $TOTAL" | bc)
else
  SCORE="0.00"
fi
echo "$SCORE" > logs/verifier/reward.txt
echo "Score: $PASS/$TOTAL = $SCORE"
