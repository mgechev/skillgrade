FROM node:20-slim

WORKDIR /workspace

RUN apt-get update && apt-get install -y --no-install-recommends bash && rm -rf /var/lib/apt/lists/*

# Module with off-by-one bugs
RUN cat > utils.js << 'EOF'
// Bug 1: Off-by-one in range generation
// Should generate [start, end] inclusive
function range(start, end) {
  const result = [];
  for (let i = start; i < end; i++) {
    result.push(i);
  }
  return result;
}

// Bug 2: Off-by-one in pagination
// Should return correct page of items (1-based page number)
function paginate(items, page, pageSize) {
  const startIndex = page * pageSize;
  const endIndex = startIndex + pageSize;
  return items.slice(startIndex, endIndex);
}

// Bug 3: Off-by-one in binary search
// Should return index of target, or -1 if not found
function binarySearch(sortedArr, target) {
  let left = 0;
  let right = sortedArr.length;
  while (left < right) {
    const mid = Math.floor((left + right) / 2);
    if (sortedArr[mid] === target) return mid;
    if (sortedArr[mid] < target) left = mid;
    else right = mid;
  }
  return -1;
}

// Bug 4: Off-by-one in chunk splitting
// Should split array into chunks of given size
function chunk(arr, size) {
  const result = [];
  for (let i = 0; i <= arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

// Bug 5: Off-by-one in string truncation
// Should truncate string to maxLen characters and add "..." if truncated
// Total length including "..." should be <= maxLen
function truncate(str, maxLen) {
  if (str.length < maxLen) return str;
  return str.substring(0, maxLen) + '...';
}

// Bug 6: Off-by-one in matrix traversal
// Should return all elements on the border of a 2D matrix
function matrixBorder(matrix) {
  if (!matrix || matrix.length === 0) return [];
  const rows = matrix.length;
  const cols = matrix[0].length;
  const border = [];
  // Top row
  for (let j = 0; j < cols; j++) border.push(matrix[0][j]);
  // Right column (excluding top)
  for (let i = 1; i < rows; i++) border.push(matrix[i][cols]);
  // Bottom row (excluding right, reversed)
  if (rows > 1) {
    for (let j = cols - 2; j >= 0; j--) border.push(matrix[rows][j]);
  }
  // Left column (excluding top and bottom)
  for (let i = rows - 2; i >= 1; i--) border.push(matrix[i][0]);
  return border;
}

module.exports = { range, paginate, binarySearch, chunk, truncate, matrixBorder };
EOF

# Test suite
RUN cat > test.js << 'TESTEOF'
const { range, paginate, binarySearch, chunk, truncate, matrixBorder } = require('./utils');

let passed = 0;
let total = 0;

function assert(condition, msg) {
  total++;
  if (condition) { passed++; console.log(`  PASS: ${msg}`); }
  else { console.log(`  FAIL: ${msg}`); }
}

function arrEq(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

// range tests - should be inclusive on both ends
assert(arrEq(range(1, 5), [1, 2, 3, 4, 5]), 'range(1,5) = [1,2,3,4,5]');
assert(arrEq(range(0, 0), [0]), 'range(0,0) = [0]');
assert(arrEq(range(3, 3), [3]), 'range(3,3) = [3]');

// paginate tests - 1-based page numbers
const items = ['a','b','c','d','e','f','g','h','i','j'];
assert(arrEq(paginate(items, 1, 3), ['a','b','c']), 'page 1 = first 3');
assert(arrEq(paginate(items, 2, 3), ['d','e','f']), 'page 2 = next 3');
assert(arrEq(paginate(items, 4, 3), ['j']), 'page 4 = last 1');

// binarySearch tests
const sorted = [1, 3, 5, 7, 9, 11, 13];
assert(binarySearch(sorted, 1) === 0, 'find first element');
assert(binarySearch(sorted, 13) === 6, 'find last element');
assert(binarySearch(sorted, 7) === 3, 'find middle element');
assert(binarySearch(sorted, 4) === -1, 'not found');

// chunk tests
assert(arrEq(chunk([1,2,3,4,5], 2), [[1,2],[3,4],[5]]), 'chunk by 2');
assert(arrEq(chunk([1,2,3], 3), [[1,2,3]]), 'chunk exact');
assert(arrEq(chunk([], 2), []), 'chunk empty');

// truncate tests
assert(truncate('hello', 10) === 'hello', 'no truncation needed');
assert(truncate('hello world', 8) === 'hello...', 'truncate to 8 (5+3)');
assert(truncate('abcdefghij', 7) === 'abcd...', 'truncate to 7 (4+3)');

// matrixBorder tests
const m = [[1,2,3],[4,5,6],[7,8,9]];
const border = matrixBorder(m);
assert(border.includes(1) && border.includes(2) && border.includes(3), 'top row in border');
assert(border.includes(6) && border.includes(9), 'right col in border');
assert(border.includes(7) && border.includes(8), 'bottom row in border');
assert(border.includes(4), 'left col in border');
assert(!border.includes(5), 'center not in border');

console.log(`\n${passed}/${total} tests passed`);
process.exit(passed === total ? 0 : 1);
TESTEOF

RUN mkdir -p logs/verifier

CMD ["bash"]
