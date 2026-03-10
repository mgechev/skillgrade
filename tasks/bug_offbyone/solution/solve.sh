#!/bin/bash
set -euo pipefail

cat > utils.js << 'EOF'
// Fixed: <= for inclusive end
function range(start, end) {
  const result = [];
  for (let i = start; i <= end; i++) {
    result.push(i);
  }
  return result;
}

// Fixed: 1-based page, so startIndex = (page-1) * pageSize
function paginate(items, page, pageSize) {
  const startIndex = (page - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  return items.slice(startIndex, endIndex);
}

// Fixed: left = mid + 1, right = sortedArr.length - 1, left <= right
function binarySearch(sortedArr, target) {
  let left = 0;
  let right = sortedArr.length - 1;
  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    if (sortedArr[mid] === target) return mid;
    if (sortedArr[mid] < target) left = mid + 1;
    else right = mid - 1;
  }
  return -1;
}

// Fixed: i < arr.length (not <=)
function chunk(arr, size) {
  const result = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

// Fixed: total length including "..." should be <= maxLen
function truncate(str, maxLen) {
  if (str.length <= maxLen) return str;
  return str.substring(0, maxLen - 3) + '...';
}

// Fixed: cols - 1 instead of cols, rows - 1 instead of rows
function matrixBorder(matrix) {
  if (!matrix || matrix.length === 0) return [];
  const rows = matrix.length;
  const cols = matrix[0].length;
  const border = [];
  for (let j = 0; j < cols; j++) border.push(matrix[0][j]);
  for (let i = 1; i < rows; i++) border.push(matrix[i][cols - 1]);
  if (rows > 1) {
    for (let j = cols - 2; j >= 0; j--) border.push(matrix[rows - 1][j]);
  }
  for (let i = rows - 2; i >= 1; i--) border.push(matrix[i][0]);
  return border;
}

module.exports = { range, paginate, binarySearch, chunk, truncate, matrixBorder };
EOF
