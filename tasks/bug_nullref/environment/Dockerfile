FROM node:20-slim

WORKDIR /workspace

RUN apt-get update && apt-get install -y --no-install-recommends bash && rm -rf /var/lib/apt/lists/*

# Module with null reference bugs
RUN cat > service.js << 'EOF'
// Bug 1: No null check on user
function getUserDisplayName(user) {
  return user.firstName + ' ' + user.lastName;
}

// Bug 2: No null check on nested property
function getShippingCity(order) {
  return order.shipping.address.city;
}

// Bug 3: No null check on array find result
function getActiveUserEmail(users, userId) {
  const user = users.find(u => u.id === userId);
  return user.email;
}

// Bug 4: No null check on optional config
function getFeatureFlag(config, flagName) {
  return config.features.flags[flagName].enabled;
}

// Bug 5: No null check on map get result
function processItems(items) {
  const categories = new Map();
  for (const item of items) {
    categories.get(item.category).push(item);
  }
  return categories;
}

// Bug 6: Missing default for undefined parameter
function formatPrice(amount, currency, locale) {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency,
  }).format(amount);
}

// Bug 7: No check for empty array before accessing first element
function getLatestEntry(entries) {
  entries.sort((a, b) => b.date - a.date);
  return entries[0].value;
}

// Bug 8: No null check after JSON parse
function parseConfig(jsonString) {
  const config = JSON.parse(jsonString);
  return {
    host: config.database.host,
    port: config.database.port,
    name: config.database.name,
  };
}

module.exports = {
  getUserDisplayName,
  getShippingCity,
  getActiveUserEmail,
  getFeatureFlag,
  processItems,
  formatPrice,
  getLatestEntry,
  parseConfig,
};
EOF

# Test suite
RUN cat > test.js << 'TESTEOF'
const {
  getUserDisplayName,
  getShippingCity,
  getActiveUserEmail,
  getFeatureFlag,
  processItems,
  formatPrice,
  getLatestEntry,
  parseConfig,
} = require('./service');

let passed = 0;
let total = 0;

function assert(condition, msg) {
  total++;
  if (condition) { passed++; console.log(`  PASS: ${msg}`); }
  else { console.log(`  FAIL: ${msg}`); }
}

// getUserDisplayName
assert(getUserDisplayName({ firstName: 'John', lastName: 'Doe' }) === 'John Doe', 'normal user');
assert(getUserDisplayName(null) === null || getUserDisplayName(null) === undefined || getUserDisplayName(null) === '', 'null user returns falsy');
assert(getUserDisplayName({}) !== undefined || true, 'empty user does not throw');

// getShippingCity
assert(getShippingCity({ shipping: { address: { city: 'NYC' } } }) === 'NYC', 'normal shipping');
assert(getShippingCity({}) === undefined || getShippingCity({}) === null, 'no shipping returns falsy');
assert(getShippingCity({ shipping: {} }) === undefined || getShippingCity({ shipping: {} }) === null, 'no address returns falsy');
assert(getShippingCity(null) === undefined || getShippingCity(null) === null, 'null order returns falsy');

// getActiveUserEmail
const users = [{ id: 1, email: 'a@b.com' }, { id: 2, email: 'c@d.com' }];
assert(getActiveUserEmail(users, 1) === 'a@b.com', 'found user email');
assert(getActiveUserEmail(users, 99) === undefined || getActiveUserEmail(users, 99) === null, 'not found returns falsy');

// getFeatureFlag
const config = { features: { flags: { darkMode: { enabled: true } } } };
assert(getFeatureFlag(config, 'darkMode') === true, 'flag exists');
assert(getFeatureFlag(config, 'missingFlag') === undefined || getFeatureFlag(config, 'missingFlag') === false, 'missing flag returns falsy');
assert(getFeatureFlag({}, 'any') === undefined || getFeatureFlag({}, 'any') === false, 'no features returns falsy');
assert(getFeatureFlag(null, 'any') === undefined || getFeatureFlag(null, 'any') === false, 'null config returns falsy');

// processItems
const items = [
  { name: 'A', category: 'x' },
  { name: 'B', category: 'y' },
  { name: 'C', category: 'x' },
];
const result = processItems(items);
assert(result instanceof Map, 'returns Map');
assert(result.get('x').length === 2, 'x has 2 items');
assert(result.get('y').length === 1, 'y has 1 item');

// formatPrice
assert(formatPrice(10.5, 'USD', 'en-US').includes('10.50'), 'normal format');
assert(typeof formatPrice(10.5) === 'string', 'no currency/locale defaults work');

// getLatestEntry
const entries = [
  { date: new Date('2024-01-01'), value: 'old' },
  { date: new Date('2024-06-01'), value: 'new' },
];
assert(getLatestEntry(entries) === 'new', 'gets latest');
assert(getLatestEntry([]) === undefined || getLatestEntry([]) === null, 'empty returns falsy');

// parseConfig
const json = JSON.stringify({ database: { host: 'localhost', port: 5432, name: 'mydb' } });
const parsed = parseConfig(json);
assert(parsed.host === 'localhost', 'parses host');
assert(parsed.port === 5432, 'parses port');
const nullParsed = parseConfig('{}');
assert(nullParsed.host === undefined || nullParsed.host === null, 'empty config returns falsy for host');
const bad = parseConfig('{"other": 1}');
assert(bad.host === undefined || bad.host === null, 'missing database returns falsy');

console.log(`\n${passed}/${total} tests passed`);
process.exit(passed === total ? 0 : 1);
TESTEOF

RUN mkdir -p logs/verifier

CMD ["bash"]
