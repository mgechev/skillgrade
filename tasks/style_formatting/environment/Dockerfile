FROM node:20-slim

WORKDIR /workspace

RUN apt-get update && apt-get install -y --no-install-recommends bash && rm -rf /var/lib/apt/lists/*

# File with formatting violations
COPY <<'EOF' app.js
var express = require("express")
var   path=require( "path" )

var app = express()

app.get("/hello",function(req,res){
    var name = req.query.name || "World"
    var greeting = "Hello, " + name + "!"
    res.send( greeting )
})

app.get("/users",function(req,res){
    var users = [
        { "name": "Alice","age": 30 },
        { "name":"Bob","age":25 },
        {"name":"Charlie" ,"age":35}
    ]
    var filtered = users.filter(function(u){
        return u.age > parseInt( req.query.min_age || "0" )
    })
    res.json( filtered )
})

app.get("/concat",function(req,res){
    var firstName = req.query.first || "John"
    var lastName = req.query.last || "Doe"
    var fullName = firstName + " " + lastName
    var message = "Welcome, " + fullName + "! You joined on " + new Date().toDateString() + "."
    res.send(message)
})

app.get("/status", function( req, res ){
    var status = {
        "server": "running",
        "uptime": process.uptime(),
        "timestamp": new Date().toISOString()
    }
    res.json(status)
})

module.exports = app
EOF

# Tests
COPY <<'TESTEOF' test_check.js
const fs = require('fs');
const source = fs.readFileSync('app.js', 'utf8');

let passed = 0;
let total = 0;

function assert(condition, msg) {
  total++;
  if (condition) { passed++; console.log(`  PASS: ${msg}`); }
  else { console.log(`  FAIL: ${msg}`); }
}

// No var usage
assert(!source.includes('var '), 'No var usage');

// No double quotes (except inside template literals)
const lines = source.split('\n');
for (const line of lines) {
  if (line.includes('"') && !line.includes('`')) {
    assert(false, 'No double quotes: ' + line.trim().substring(0, 50));
    break;
  }
}
assert(!lines.some(l => l.includes('"') && !l.includes('`')), 'No double quotes overall');

// Semicolons at end of statements
const stmtLines = lines.filter(l => {
  const trimmed = l.trim();
  return trimmed && !trimmed.startsWith('//') && !trimmed.startsWith('*') &&
    !trimmed.endsWith('{') && !trimmed.endsWith('}') && !trimmed.endsWith('(') &&
    !trimmed.endsWith(',') && trimmed !== '' && !trimmed.startsWith('const') &&
    trimmed.includes('=');
});

// Uses arrow functions
assert(source.includes('=>'), 'Uses arrow functions');

// No string concatenation with +
assert(!source.match(/['"][^']*['"]\s*\+\s*\w/), 'No string concatenation with +');

// Uses template literals
assert(source.includes('`'), 'Uses template literals');

// 2-space indentation (no 4-space or tab)
const indentedLines = lines.filter(l => l.startsWith(' '));
const has4Space = indentedLines.some(l => l.match(/^ {4}[^ ]/));
const hasTab = lines.some(l => l.includes('\t'));
assert(!hasTab, 'No tab indentation');

// Module still works
try {
  const app = require('./app');
  assert(typeof app === 'object' || typeof app === 'function', 'Module loads');
} catch(e) {
  assert(false, 'Module loads: ' + e.message);
}

console.log(`\n${passed}/${total} tests passed`);
process.exit(passed === total ? 0 : 1);
TESTEOF

RUN npm init -y && npm install express

RUN mkdir -p logs/verifier

CMD ["bash"]
