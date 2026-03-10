FROM node:20-slim

WORKDIR /workspace

RUN apt-get update && apt-get install -y --no-install-recommends \
    bash \
    && rm -rf /var/lib/apt/lists/*

RUN npm init -y && npm install express

# Vulnerable application with XSS
RUN cat > app.js << 'APPEOF'
const express = require('express');
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const messages = [];

// VULN 1: Reflected XSS in search
app.get('/search', (req, res) => {
  const { q } = req.query;
  res.send(`<html><body><h1>Search Results for: ${q}</h1><p>No results found.</p></body></html>`);
});

// VULN 2: Stored XSS in message board
app.post('/messages', (req, res) => {
  const { author, text } = req.body;
  messages.push({ author, text, date: new Date().toISOString() });
  res.redirect('/messages');
});

app.get('/messages', (req, res) => {
  let html = '<html><body><h1>Messages</h1><ul>';
  for (const msg of messages) {
    html += `<li><strong>${msg.author}</strong>: ${msg.text} <em>(${msg.date})</em></li>`;
  }
  html += '</ul></body></html>';
  res.send(html);
});

// VULN 3: DOM-based XSS via URL parameter in error page
app.get('/error', (req, res) => {
  const { message } = req.query;
  res.send(`<html><body><div class="error"><h2>Error</h2><p>${message}</p></div></body></html>`);
});

// VULN 4: XSS in user profile rendering
app.get('/profile/:name', (req, res) => {
  const { name } = req.params;
  const { bio } = req.query;
  res.send(`<html><body><h1>Profile: ${name}</h1><div class="bio">${bio || 'No bio provided'}</div></body></html>`);
});

module.exports = app;
APPEOF

# Functional tests
RUN cat > test_functional.js << 'TESTEOF'
const fs = require('fs');
const source = fs.readFileSync('app.js', 'utf8');

let passed = 0;
let total = 0;

function assert(condition, msg) {
  total++;
  if (condition) { passed++; console.log(`  PASS: ${msg}`); }
  else { console.log(`  FAIL: ${msg}`); }
}

// Must have an escapeHtml function or equivalent
assert(source.includes('escapeHtml') || source.includes('escape') || source.includes('sanitize') || source.includes('encode'), 'Has HTML escaping function');

// Must not have direct template literal injection of user input
const vulnPatterns = [
  /\$\{q\}/,
  /\$\{msg\.author\}/,
  /\$\{msg\.text\}/,
  /\$\{message\}/,
  /\$\{name\}/,
  /\$\{bio\}/
];

for (const pattern of vulnPatterns) {
  assert(!pattern.test(source), `No direct interpolation: ${pattern.source}`);
}

// Endpoints still exist
assert(source.includes("'/search'") || source.includes('"/search"'), 'Search endpoint exists');
assert(source.includes("'/messages'") || source.includes('"/messages"'), 'Messages endpoint exists');
assert(source.includes("'/error'") || source.includes('"/error"'), 'Error endpoint exists');
assert(source.includes("'/profile/:name'") || source.includes('"/profile/:name"'), 'Profile endpoint exists');

console.log(`\n${passed}/${total} tests passed`);
process.exit(passed === total ? 0 : 1);
TESTEOF

RUN mkdir -p logs/verifier

CMD ["bash"]
