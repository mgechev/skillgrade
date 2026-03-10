#!/bin/bash
set -euo pipefail

cat > App.jsx << 'EOF'
import React, { useState, useMemo, useCallback, memo } from 'react';

const containerStyle = { padding: '20px', margin: '10px' };

function UserList({ users }) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(
    () => users.filter(u => u.name.toLowerCase().includes(search.toLowerCase())),
    [users, search]
  );

  const handleSelect = useCallback((id) => {
    console.log(id);
  }, []);

  return (
    <div style={containerStyle}>
      <input value={search} onChange={e => setSearch(e.target.value)} />
      {filtered.map(u => (
        <UserCard key={u.id} user={u} onSelect={() => handleSelect(u.id)} />
      ))}
    </div>
  );
}

const UserCard = memo(function UserCard({ user, onSelect }) {
  return (
    <div onClick={onSelect}>
      <h3>{user.name}</h3>
      <p>{user.email}</p>
    </div>
  );
});

function Dashboard({ data }) {
  const [tab, setTab] = useState('overview');

  const stats = useMemo(() => computeExpensiveStats(data), [data]);
  const chartData = useMemo(() => data.map(d => ({ x: d.date, y: d.value })), [data]);

  return (
    <div>
      <button onClick={() => setTab('overview')}>Overview</button>
      <button onClick={() => setTab('details')}>Details</button>
      {tab === 'overview' && <StatsPanel stats={stats} />}
      {tab === 'details' && <ChartPanel data={chartData} />}
    </div>
  );
}

const StatsPanel = memo(function StatsPanel({ stats }) {
  return (
    <div>
      <p>Total: {stats.total}</p>
      <p>Average: {stats.average}</p>
    </div>
  );
});

const ChartPanel = memo(function ChartPanel({ data }) {
  return (
    <div>
      {data.map((point, i) => (
        <div key={i}>{point.x}: {point.y}</div>
      ))}
    </div>
  );
});

function computeExpensiveStats(data) {
  let total = 0;
  for (const d of data) total += d.value;
  return { total, average: total / data.length };
}

export { UserList, UserCard, Dashboard, StatsPanel, ChartPanel };
EOF
