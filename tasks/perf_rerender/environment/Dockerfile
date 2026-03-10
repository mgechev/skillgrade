FROM node:20-slim

WORKDIR /workspace

RUN apt-get update && apt-get install -y --no-install-recommends bash && rm -rf /var/lib/apt/lists/*

# React component with re-render issues
RUN cat > App.jsx << 'JSXEOF'
import React, { useState } from 'react';

// Problem 1: Creates new object on every render
function UserList({ users }) {
  const [search, setSearch] = useState('');

  const containerStyle = { padding: '20px', margin: '10px' };

  const filtered = users.filter(u => u.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div style={containerStyle}>
      <input value={search} onChange={e => setSearch(e.target.value)} />
      {filtered.map(u => (
        <UserCard key={u.id} user={u} onSelect={() => console.log(u.id)} />
      ))}
    </div>
  );
}

// Problem 2: Re-renders even when props don't change
function UserCard({ user, onSelect }) {
  return (
    <div onClick={onSelect}>
      <h3>{user.name}</h3>
      <p>{user.email}</p>
    </div>
  );
}

// Problem 3: Expensive computation on every render
function Dashboard({ data }) {
  const [tab, setTab] = useState('overview');

  const stats = computeExpensiveStats(data);
  const chartData = data.map(d => ({ x: d.date, y: d.value }));

  return (
    <div>
      <button onClick={() => setTab('overview')}>Overview</button>
      <button onClick={() => setTab('details')}>Details</button>
      {tab === 'overview' && <StatsPanel stats={stats} />}
      {tab === 'details' && <ChartPanel data={chartData} />}
    </div>
  );
}

// Problem 4: Re-renders child unnecessarily
function StatsPanel({ stats }) {
  return (
    <div>
      <p>Total: {stats.total}</p>
      <p>Average: {stats.average}</p>
    </div>
  );
}

function ChartPanel({ data }) {
  return (
    <div>
      {data.map((point, i) => (
        <div key={i}>{point.x}: {point.y}</div>
      ))}
    </div>
  );
}

function computeExpensiveStats(data) {
  let total = 0;
  for (const d of data) total += d.value;
  return { total, average: total / data.length };
}

export { UserList, UserCard, Dashboard, StatsPanel, ChartPanel };
JSXEOF

# Static analysis tests
RUN cat > test_checks.js << 'TESTEOF'
const fs = require('fs');
const source = fs.readFileSync('App.jsx', 'utf8');

let passed = 0;
let total = 0;

function assert(condition, msg) {
  total++;
  if (condition) { passed++; console.log(`  PASS: ${msg}`); }
  else { console.log(`  FAIL: ${msg}`); }
}

// Check React.memo usage
assert(source.includes('React.memo') || source.includes('memo('), 'Uses React.memo');

// Check useMemo usage
assert(source.includes('useMemo'), 'Uses useMemo');

// Check useCallback usage
assert(source.includes('useCallback'), 'Uses useCallback');

// Check that containerStyle is memoized or moved outside
const styleOutside = !source.match(/function UserList[\s\S]*?const containerStyle/);
const styleMemoized = source.match(/useMemo\(\s*\(\)\s*=>\s*\(\s*\{.*padding/s) || source.match(/useMemo\(\s*\(\)\s*=>\s*\{.*padding/s);
assert(styleOutside || styleMemoized || source.match(/const containerStyle[\s\S]*?useMemo/), 'Style object is stable (outside component or useMemo)');

// Check that computeExpensiveStats result is memoized
assert(source.includes('useMemo') && source.match(/useMemo\([\s\S]*?computeExpensiveStats/), 'computeExpensiveStats result is memoized');

// Check inline function in map is memoized
assert(source.includes('useCallback') && source.match(/useCallback\([\s\S]*?console\.log/), 'onSelect callback is memoized');

// Components still exist
assert(source.includes('UserList'), 'UserList exists');
assert(source.includes('UserCard'), 'UserCard exists');
assert(source.includes('Dashboard'), 'Dashboard exists');
assert(source.includes('StatsPanel'), 'StatsPanel exists');
assert(source.includes('ChartPanel'), 'ChartPanel exists');

console.log(`\n${passed}/${total} tests passed`);
process.exit(passed === total ? 0 : 1);
TESTEOF

RUN mkdir -p logs/verifier

CMD ["bash"]
