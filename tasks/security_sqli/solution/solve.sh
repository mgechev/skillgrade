#!/bin/bash
set -euo pipefail

cat > app.js << 'EOF'
const express = require('express');
const db = require('./db');
const app = express();
app.use(express.json());

// FIXED: Parameterized query
app.get('/api/users/search', (req, res) => {
  const { username } = req.query;
  const rows = db.prepare('SELECT * FROM users WHERE username = ?').all(username);
  res.json(rows);
});

// FIXED: Parameterized query
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const row = db.prepare('SELECT * FROM users WHERE username = ? AND role = ?').get(username, password);
  if (row) {
    res.json({ success: true, user: row });
  } else {
    res.json({ success: false });
  }
});

// FIXED: Parameterized query + ORDER BY whitelist
app.get('/api/products', (req, res) => {
  const { category, sort } = req.query;
  const allowedSorts = ['name', 'price', 'category'];
  let query = 'SELECT * FROM products';
  const params = [];
  if (category) {
    query += ' WHERE category = ?';
    params.push(category);
  }
  if (sort && allowedSorts.includes(sort)) {
    query += ` ORDER BY ${sort}`;
  }
  const rows = db.prepare(query).all(...params);
  res.json(rows);
});

// FIXED: Parameterized query with integer validation
app.delete('/api/users/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    return res.status(400).json({ error: 'Invalid ID' });
  }
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
  res.json({ deleted: true });
});

module.exports = app;
EOF
