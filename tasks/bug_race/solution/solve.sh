#!/bin/bash
set -euo pipefail

cat > async-service.js << 'EOF'
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Fixed: await the promise before accessing .name
async function fetchUserData(userId) {
  const data = await delay(10).then(() => ({ id: userId, name: `User ${userId}` }));
  return data.name;
}

// Fixed: use atomic increment pattern
let requestCount = 0;
let requestMutex = Promise.resolve();
async function trackRequest(requestId) {
  await (requestMutex = requestMutex.then(async () => {
    await delay(5);
    requestCount++;
  }));
  return requestCount;
}

function getRequestCount() {
  return requestCount;
}

function resetRequestCount() {
  requestCount = 0;
  requestMutex = Promise.resolve();
}

// Fixed: await fetchData
async function safeFetch(url) {
  try {
    const result = await fetchData(url);
    return { success: true, data: result };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

async function fetchData(url) {
  await delay(5);
  if (url === 'bad') throw new Error('Network error');
  return { url, content: 'data' };
}

// Fixed: await all promises with Promise.all
async function processAllItems(items) {
  const results = await Promise.all(items.map(item => processItem(item)));
  return results;
}

async function processItem(item) {
  await delay(5);
  return { ...item, processed: true };
}

// Fixed: use for-of instead of forEach for async
async function validateAll(items) {
  const errors = [];
  for (const item of items) {
    await delay(5);
    if (!item.name) {
      errors.push(`Item ${item.id} missing name`);
    }
  }
  return errors;
}

module.exports = {
  fetchUserData,
  trackRequest,
  getRequestCount,
  resetRequestCount,
  safeFetch,
  processAllItems,
  processItem,
  validateAll,
};
EOF
