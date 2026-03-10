FROM node:20-slim

WORKDIR /workspace

RUN apt-get update && apt-get install -y --no-install-recommends bash && rm -rf /var/lib/apt/lists/*

# Module with race condition bugs
RUN cat > async-service.js << 'EOF'
// Simulated async operations
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Bug 1: Missing await - returns promise instead of value
async function fetchUserData(userId) {
  const data = delay(10).then(() => ({ id: userId, name: `User ${userId}` }));
  return data.name;
}

// Bug 2: Race condition in counter - concurrent increments
let requestCount = 0;
async function trackRequest(requestId) {
  const current = requestCount;
  await delay(5);
  requestCount = current + 1;
  return requestCount;
}

function getRequestCount() {
  return requestCount;
}

function resetRequestCount() {
  requestCount = 0;
}

// Bug 3: Missing await in error handling
async function safeFetch(url) {
  try {
    const result = fetchData(url);
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

// Bug 4: Parallel operations treated as sequential, losing results
async function processAllItems(items) {
  const results = [];
  for (const item of items) {
    processItem(item).then(result => results.push(result));
  }
  return results;
}

async function processItem(item) {
  await delay(5);
  return { ...item, processed: true };
}

// Bug 5: Async forEach doesn't wait
async function validateAll(items) {
  const errors = [];
  items.forEach(async (item) => {
    await delay(5);
    if (!item.name) {
      errors.push(`Item ${item.id} missing name`);
    }
  });
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

# Test suite
RUN cat > test.js << 'TESTEOF'
const {
  fetchUserData,
  trackRequest,
  getRequestCount,
  resetRequestCount,
  safeFetch,
  processAllItems,
  validateAll,
} = require('./async-service');

let passed = 0;
let total = 0;

function assert(condition, msg) {
  total++;
  if (condition) { passed++; console.log(`  PASS: ${msg}`); }
  else { console.log(`  FAIL: ${msg}`); }
}

async function runTests() {
  // fetchUserData
  const user = await fetchUserData(42);
  assert(user === 'User 42', 'fetchUserData returns name string');

  // trackRequest - sequential should work
  resetRequestCount();
  await trackRequest('r1');
  await trackRequest('r2');
  await trackRequest('r3');
  assert(getRequestCount() === 3, 'sequential trackRequest = 3');

  // trackRequest - concurrent should also work
  resetRequestCount();
  await Promise.all([trackRequest('a'), trackRequest('b'), trackRequest('c')]);
  assert(getRequestCount() === 3, 'concurrent trackRequest = 3');

  // safeFetch - success
  const good = await safeFetch('good');
  assert(good.success === true, 'safeFetch good succeeds');
  assert(good.data && good.data.url === 'good', 'safeFetch good has data');

  // safeFetch - error
  const bad = await safeFetch('bad');
  assert(bad.success === false, 'safeFetch bad fails');
  assert(bad.error === 'Network error', 'safeFetch bad has error message');

  // processAllItems
  const items = [{ id: 1 }, { id: 2 }, { id: 3 }];
  const processed = await processAllItems(items);
  assert(processed.length === 3, 'processAllItems returns 3 results');
  assert(processed.every(p => p.processed === true), 'all items processed');

  // validateAll
  const badItems = [{ id: 1, name: 'ok' }, { id: 2 }, { id: 3, name: 'ok' }];
  const errors = await validateAll(badItems);
  assert(errors.length === 1, 'validateAll finds 1 error');
  assert(errors[0].includes('2'), 'error mentions item 2');

  console.log(`\n${passed}/${total} tests passed`);
  process.exit(passed === total ? 0 : 1);
}

runTests().catch(e => {
  console.error('Test runner error:', e);
  process.exit(1);
});
TESTEOF

RUN mkdir -p logs/verifier

CMD ["bash"]
