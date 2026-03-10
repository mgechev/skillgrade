FROM node:20-slim

WORKDIR /workspace

RUN apt-get update && apt-get install -y --no-install-recommends \
    bash \
    && rm -rf /var/lib/apt/lists/*

RUN npm init -y && npm install express

# Create public directory with sample files
RUN mkdir -p public/images public/docs
RUN echo "Welcome to the site" > public/index.html
RUN echo "Sample document" > public/docs/readme.txt
RUN echo "Secret config" > /etc/secret.conf

# Vulnerable application
RUN cat > app.js << 'APPEOF'
const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();

const PUBLIC_DIR = path.join(__dirname, 'public');

// VULN 1: Direct path concatenation
app.get('/files/:filename', (req, res) => {
  const filePath = PUBLIC_DIR + '/' + req.params.filename;
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    res.send(content);
  } catch (e) {
    res.status(404).send('File not found');
  }
});

// VULN 2: Path traversal via query parameter
app.get('/download', (req, res) => {
  const { file } = req.query;
  const filePath = path.join(PUBLIC_DIR, file);
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    res.send(content);
  } catch (e) {
    res.status(404).send('File not found');
  }
});

// VULN 3: Directory listing with traversal
app.get('/list', (req, res) => {
  const dir = req.query.dir || '';
  const dirPath = path.join(PUBLIC_DIR, dir);
  try {
    const files = fs.readdirSync(dirPath);
    res.json(files);
  } catch (e) {
    res.status(404).json({ error: 'Directory not found' });
  }
});

// VULN 4: File upload path traversal
app.post('/upload', express.text(), (req, res) => {
  const filename = req.query.name;
  const filePath = path.join(PUBLIC_DIR, filename);
  fs.writeFileSync(filePath, req.body);
  res.json({ saved: filename });
});

module.exports = app;
APPEOF

# Functional tests
RUN cat > test_functional.js << 'TESTEOF'
const fs = require('fs');
const path = require('path');
const source = fs.readFileSync('app.js', 'utf8');

let passed = 0;
let total = 0;

function assert(condition, msg) {
  total++;
  if (condition) { passed++; console.log(`  PASS: ${msg}`); }
  else { console.log(`  FAIL: ${msg}`); }
}

// Must use path.resolve or realpath for validation
assert(source.includes('path.resolve') || source.includes('realpath') || source.includes('normalize'), 'Uses path resolution');

// Must check that resolved path starts with base directory
assert(source.includes('startsWith') || source.includes('indexOf'), 'Checks path prefix');

// Must not have raw concatenation: PUBLIC_DIR + '/' +
assert(!source.includes("PUBLIC_DIR + '/' +") && !source.includes('PUBLIC_DIR + "/" +'), 'No raw path concatenation');

// Endpoints still exist
assert(source.includes("'/files/:filename'") || source.includes('"/files/:filename"'), 'Files endpoint exists');
assert(source.includes("'/download'") || source.includes('"/download"'), 'Download endpoint exists');
assert(source.includes("'/list'") || source.includes('"/list"'), 'List endpoint exists');
assert(source.includes("'/upload'") || source.includes('"/upload"'), 'Upload endpoint exists');

// Should have error responses for traversal attempts
assert(source.includes('403') || source.includes('forbidden') || source.includes('Forbidden') || source.includes('Access denied'), 'Returns 403 for traversal');

console.log(`\n${passed}/${total} tests passed`);
process.exit(passed === total ? 0 : 1);
TESTEOF

RUN mkdir -p logs/verifier

CMD ["bash"]
