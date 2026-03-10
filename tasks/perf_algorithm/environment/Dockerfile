FROM node:20-slim

WORKDIR /workspace

RUN apt-get update && apt-get install -y --no-install-recommends bash && rm -rf /var/lib/apt/lists/*

# Utility module with poor performance
RUN cat > utils.js << 'EOF'
// Find duplicates in array - O(n²)
function findDuplicates(arr) {
  const dupes = [];
  for (let i = 0; i < arr.length; i++) {
    for (let j = i + 1; j < arr.length; j++) {
      if (arr[i] === arr[j] && !dupes.includes(arr[i])) {
        dupes.push(arr[i]);
      }
    }
  }
  return dupes;
}

// Find intersection of two arrays - O(n*m)
function intersection(arr1, arr2) {
  const result = [];
  for (const item of arr1) {
    for (const item2 of arr2) {
      if (item === item2 && !result.includes(item)) {
        result.push(item);
      }
    }
  }
  return result;
}

// Group by key - O(n²) due to find
function groupBy(arr, key) {
  const groups = [];
  for (const item of arr) {
    let found = false;
    for (const group of groups) {
      if (group.key === item[key]) {
        group.items.push(item);
        found = true;
        break;
      }
    }
    if (!found) {
      groups.push({ key: item[key], items: [item] });
    }
  }
  return groups;
}

// Find two numbers that sum to target - O(n²)
function twoSum(nums, target) {
  for (let i = 0; i < nums.length; i++) {
    for (let j = i + 1; j < nums.length; j++) {
      if (nums[i] + nums[j] === target) {
        return [i, j];
      }
    }
  }
  return null;
}

// Count frequency of each element - O(n²)
function frequency(arr) {
  const result = [];
  for (const item of arr) {
    let found = false;
    for (const entry of result) {
      if (entry.value === item) {
        entry.count++;
        found = true;
        break;
      }
    }
    if (!found) {
      result.push({ value: item, count: 1 });
    }
  }
  return result;
}

module.exports = { findDuplicates, intersection, groupBy, twoSum, frequency };
EOF

# Correctness tests
RUN cat > test_correctness.js << 'EOF'
const { findDuplicates, intersection, groupBy, twoSum, frequency } = require('./utils');

let passed = 0;
let total = 0;

function assert(condition, msg) {
  total++;
  if (condition) { passed++; console.log(`  PASS: ${msg}`); }
  else { console.log(`  FAIL: ${msg}`); }
}

function arrEq(a, b) {
  if (!a || !b) return a === b;
  return JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
}

// findDuplicates tests
assert(arrEq(findDuplicates([1,2,3,2,4,3]), [2,3]), 'findDuplicates basic');
assert(arrEq(findDuplicates([1,2,3]), []), 'findDuplicates no dupes');
assert(arrEq(findDuplicates([]), []), 'findDuplicates empty');

// intersection tests
assert(arrEq(intersection([1,2,3], [2,3,4]), [2,3]), 'intersection basic');
assert(arrEq(intersection([1,2], [3,4]), []), 'intersection no overlap');
assert(arrEq(intersection([], [1,2]), []), 'intersection empty');

// groupBy tests
const data = [{name:'a',cat:'x'},{name:'b',cat:'y'},{name:'c',cat:'x'}];
const groups = groupBy(data, 'cat');
assert(groups.length === 2, 'groupBy count');
const xGroup = groups.find(g => g.key === 'x');
assert(xGroup && xGroup.items.length === 2, 'groupBy x items');

// twoSum tests
assert(arrEq(twoSum([2,7,11,15], 9), [0,1]), 'twoSum basic');
assert(twoSum([1,2,3], 10) === null, 'twoSum no match');

// frequency tests
const freq = frequency(['a','b','a','c','b','a']);
const aFreq = freq.find(f => f.value === 'a');
assert(aFreq && aFreq.count === 3, 'frequency count');

console.log(`\n${passed}/${total} tests passed`);
process.exit(passed === total ? 0 : 1);
EOF

# Benchmark
RUN cat > bench.js << 'EOF'
const { findDuplicates, intersection, groupBy, twoSum, frequency } = require('./utils');

const N = 10000;
const arr = Array.from({length: N}, (_, i) => i % (N/2));
const arr2 = Array.from({length: N}, (_, i) => i % (N/3));
const objects = arr.map((v, i) => ({id: i, cat: `cat${v % 10}`}));

console.log('Benchmarking with N =', N);

let start;

start = Date.now();
findDuplicates(arr);
console.log(`findDuplicates: ${Date.now() - start}ms`);

start = Date.now();
intersection(arr, arr2);
console.log(`intersection: ${Date.now() - start}ms`);

start = Date.now();
groupBy(objects, 'cat');
console.log(`groupBy: ${Date.now() - start}ms`);

start = Date.now();
twoSum(arr, N - 1);
console.log(`twoSum: ${Date.now() - start}ms`);

start = Date.now();
frequency(arr);
console.log(`frequency: ${Date.now() - start}ms`);
EOF

RUN mkdir -p logs/verifier

CMD ["bash"]
