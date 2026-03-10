#!/bin/bash
set -euo pipefail

cat > utils.js << 'EOF'
// Find duplicates in array - O(n) using Set
function findDuplicates(arr) {
  const seen = new Set();
  const dupes = new Set();
  for (const item of arr) {
    if (seen.has(item)) {
      dupes.add(item);
    }
    seen.add(item);
  }
  return [...dupes];
}

// Find intersection of two arrays - O(n+m) using Set
function intersection(arr1, arr2) {
  const set2 = new Set(arr2);
  const result = new Set();
  for (const item of arr1) {
    if (set2.has(item)) {
      result.add(item);
    }
  }
  return [...result];
}

// Group by key - O(n) using Map
function groupBy(arr, key) {
  const map = new Map();
  for (const item of arr) {
    const k = item[key];
    if (!map.has(k)) {
      map.set(k, { key: k, items: [] });
    }
    map.get(k).items.push(item);
  }
  return [...map.values()];
}

// Find two numbers that sum to target - O(n) using Map
function twoSum(nums, target) {
  const map = new Map();
  for (let i = 0; i < nums.length; i++) {
    const complement = target - nums[i];
    if (map.has(complement)) {
      return [map.get(complement), i];
    }
    map.set(nums[i], i);
  }
  return null;
}

// Count frequency of each element - O(n) using Map
function frequency(arr) {
  const map = new Map();
  for (const item of arr) {
    map.set(item, (map.get(item) || 0) + 1);
  }
  return [...map.entries()].map(([value, count]) => ({ value, count }));
}

module.exports = { findDuplicates, intersection, groupBy, twoSum, frequency };
EOF
