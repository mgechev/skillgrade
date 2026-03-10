#!/bin/bash
set -euo pipefail

cat > app.js << 'EOF'
const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();

const PUBLIC_DIR = path.resolve(__dirname, 'public');

function safePath(base, userPath) {
  const resolved = path.resolve(base, userPath);
  if (!resolved.startsWith(base + path.sep) && resolved !== base) {
    return null;
  }
  return resolved;
}

// FIXED: Path validation
app.get('/files/:filename', (req, res) => {
  const filePath = safePath(PUBLIC_DIR, req.params.filename);
  if (!filePath) {
    return res.status(403).send('Forbidden');
  }
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    res.send(content);
  } catch (e) {
    res.status(404).send('File not found');
  }
});

// FIXED: Path validation
app.get('/download', (req, res) => {
  const { file } = req.query;
  const filePath = safePath(PUBLIC_DIR, file);
  if (!filePath) {
    return res.status(403).send('Forbidden');
  }
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    res.send(content);
  } catch (e) {
    res.status(404).send('File not found');
  }
});

// FIXED: Path validation
app.get('/list', (req, res) => {
  const dir = req.query.dir || '';
  const dirPath = safePath(PUBLIC_DIR, dir);
  if (!dirPath) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  try {
    const files = fs.readdirSync(dirPath);
    res.json(files);
  } catch (e) {
    res.status(404).json({ error: 'Directory not found' });
  }
});

// FIXED: Path validation
app.post('/upload', express.text(), (req, res) => {
  const filename = req.query.name;
  const filePath = safePath(PUBLIC_DIR, filename);
  if (!filePath) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  fs.writeFileSync(filePath, req.body);
  res.json({ saved: filename });
});

module.exports = app;
EOF
