#!/bin/bash
set -euo pipefail

cat > app.js << 'SOLEOF'
const express = require('express');
const path = require('path');

const app = express();

app.get('/hello', (req, res) => {
  const name = req.query.name || 'World';
  const greeting = `Hello, ${name}!`;
  res.send(greeting);
});

app.get('/users', (req, res) => {
  const users = [
    { name: 'Alice', age: 30 },
    { name: 'Bob', age: 25 },
    { name: 'Charlie', age: 35 },
  ];
  const filtered = users.filter((u) => {
    return u.age > parseInt(req.query.min_age || '0');
  });
  res.json(filtered);
});

app.get('/concat', (req, res) => {
  const firstName = req.query.first || 'John';
  const lastName = req.query.last || 'Doe';
  const fullName = `${firstName} ${lastName}`;
  const message = `Welcome, ${fullName}! You joined on ${new Date().toDateString()}.`;
  res.send(message);
});

app.get('/status', (req, res) => {
  const status = {
    server: 'running',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  };
  res.json(status);
});

module.exports = app;
SOLEOF
