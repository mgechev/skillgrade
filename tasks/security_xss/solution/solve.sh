#!/bin/bash
set -euo pipefail

cat > app.js << 'EOF'
const express = require('express');
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const messages = [];

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// FIXED: Escaped output
app.get('/search', (req, res) => {
  const { q } = req.query;
  res.send(`<html><body><h1>Search Results for: ${escapeHtml(q)}</h1><p>No results found.</p></body></html>`);
});

// FIXED: Stored XSS prevention
app.post('/messages', (req, res) => {
  const { author, text } = req.body;
  messages.push({ author, text, date: new Date().toISOString() });
  res.redirect('/messages');
});

app.get('/messages', (req, res) => {
  let html = '<html><body><h1>Messages</h1><ul>';
  for (const msg of messages) {
    html += `<li><strong>${escapeHtml(msg.author)}</strong>: ${escapeHtml(msg.text)} <em>(${msg.date})</em></li>`;
  }
  html += '</ul></body></html>';
  res.send(html);
});

// FIXED: Escaped error message
app.get('/error', (req, res) => {
  const { message } = req.query;
  res.send(`<html><body><div class="error"><h2>Error</h2><p>${escapeHtml(message)}</p></div></body></html>`);
});

// FIXED: Escaped profile data
app.get('/profile/:name', (req, res) => {
  const { name } = req.params;
  const { bio } = req.query;
  res.send(`<html><body><h1>Profile: ${escapeHtml(name)}</h1><div class="bio">${escapeHtml(bio) || 'No bio provided'}</div></body></html>`);
});

module.exports = app;
EOF
