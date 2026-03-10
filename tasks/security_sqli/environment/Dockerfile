FROM node:20-slim

WORKDIR /workspace

RUN apt-get update && apt-get install -y --no-install-recommends \
    bash \
    && rm -rf /var/lib/apt/lists/*

RUN npm init -y && npm install express better-sqlite3

# Database setup
RUN cat > db.js << 'DBEOF'
const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'app.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    email TEXT NOT NULL,
    role TEXT DEFAULT 'user'
  );
  INSERT OR IGNORE INTO users (id, username, email, role) VALUES
    (1, 'alice', 'alice@example.com', 'admin'),
    (2, 'bob', 'bob@example.com', 'user'),
    (3, 'charlie', 'charlie@example.com', 'user');

  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    price REAL NOT NULL,
    category TEXT
  );
  INSERT OR IGNORE INTO products (id, name, price, category) VALUES
    (1, 'Laptop', 999.99, 'electronics'),
    (2, 'Book', 19.99, 'books'),
    (3, 'Phone', 599.99, 'electronics');
`);

module.exports = db;
DBEOF

# Vulnerable application
RUN cat > app.js << 'APPEOF'
const express = require('express');
const db = require('./db');
const app = express();
app.use(express.json());

// VULN 1: SQL injection in search
app.get('/api/users/search', (req, res) => {
  const { username } = req.query;
  const rows = db.prepare(`SELECT * FROM users WHERE username = '${username}'`).all();
  res.json(rows);
});

// VULN 2: SQL injection in login check
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const row = db.prepare(`SELECT * FROM users WHERE username = '${username}' AND role = '${password}'`).get();
  if (row) {
    res.json({ success: true, user: row });
  } else {
    res.json({ success: false });
  }
});

// VULN 3: SQL injection in product filter
app.get('/api/products', (req, res) => {
  const { category, sort } = req.query;
  let query = 'SELECT * FROM products';
  if (category) {
    query += ` WHERE category = '${category}'`;
  }
  if (sort) {
    query += ` ORDER BY ${sort}`;
  }
  const rows = db.prepare(query).all();
  res.json(rows);
});

// VULN 4: SQL injection in user deletion
app.delete('/api/users/:id', (req, res) => {
  const { id } = req.params;
  db.prepare(`DELETE FROM users WHERE id = ${id}`).run();
  res.json({ deleted: true });
});

module.exports = app;
APPEOF

# Functional tests
RUN cat > test_functional.js << 'TESTEOF'
const db = require('./db');
const app = require('./app');

// Simple test runner
let passed = 0;
let total = 0;

function assert(condition, msg) {
  total++;
  if (condition) {
    passed++;
    console.log(`  PASS: ${msg}`);
  } else {
    console.log(`  FAIL: ${msg}`);
  }
}

// Reset DB for tests
db.exec("DELETE FROM users; INSERT INTO users (id, username, email, role) VALUES (1, 'alice', 'alice@example.com', 'admin'), (2, 'bob', 'bob@example.com', 'user'), (3, 'charlie', 'charlie@example.com', 'user');");

// Test: source code should not have string interpolation in SQL
const fs = require('fs');
const source = fs.readFileSync('app.js', 'utf8');

assert(!source.includes('`SELECT') && !source.match(/\$\{.*\}.*SELECT|SELECT.*\$\{/), 'No template literal interpolation in SQL queries');
assert(source.includes('.prepare(') || source.includes('.run('), 'Still uses prepare statements');

// Test: parameterized queries pattern
const paramPatterns = [/\.prepare\([^)]*\?\s*[^)]*\)/, /\.prepare\([^`']*\)/];
assert(paramPatterns.some(p => p.test(source)), 'Uses parameterized query syntax');

// Test: endpoints still exist
assert(source.includes("'/api/users/search'") || source.includes('"/api/users/search"'), 'Search endpoint exists');
assert(source.includes("'/api/login'") || source.includes('"/api/login"'), 'Login endpoint exists');
assert(source.includes("'/api/products'") || source.includes('"/api/products"'), 'Products endpoint exists');
assert(source.includes("'/api/users/:id'") || source.includes('"/api/users/:id"'), 'Delete endpoint exists');

// Test: ORDER BY should be whitelisted, not interpolated
const orderBySection = source.substring(source.indexOf('/api/products'));
assert(!orderBySection.includes('ORDER BY ${') && !orderBySection.includes("ORDER BY ' +"), 'ORDER BY is not directly interpolated');

console.log(`\n${passed}/${total} tests passed`);
process.exit(passed === total ? 0 : 1);
TESTEOF

RUN mkdir -p logs/verifier

CMD ["bash"]
