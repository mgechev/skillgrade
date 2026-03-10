#!/bin/bash
set -euo pipefail

cat > app.js << 'EOF'
const db = require('./db');

// FIXED: Single query with JOIN, then group in JS
function getAuthorsWithBooks() {
  const rows = db.prepare(`
    SELECT a.*, b.id as book_id, b.title, b.author_id as b_author_id, b.year
    FROM authors a
    LEFT JOIN books b ON a.id = b.author_id
  `).all();

  const authorMap = new Map();
  for (const row of rows) {
    if (!authorMap.has(row.id)) {
      authorMap.set(row.id, { id: row.id, name: row.name, country: row.country, books: [] });
    }
    if (row.book_id) {
      authorMap.get(row.id).books.push({ id: row.book_id, title: row.title, author_id: row.b_author_id, year: row.year });
    }
  }
  return [...authorMap.values()];
}

// FIXED: Two queries (books+authors JOIN, then batch reviews)
function getBooksWithDetails() {
  const books = db.prepare(`
    SELECT b.*, a.id as a_id, a.name as a_name, a.country as a_country
    FROM books b
    JOIN authors a ON b.author_id = a.id
  `).all();

  const allReviews = db.prepare('SELECT * FROM reviews').all();
  const reviewMap = new Map();
  for (const r of allReviews) {
    if (!reviewMap.has(r.book_id)) reviewMap.set(r.book_id, []);
    reviewMap.get(r.book_id).push(r);
  }

  return books.map(b => ({
    id: b.id, title: b.title, author_id: b.author_id, year: b.year,
    author: { id: b.a_id, name: b.a_name, country: b.a_country },
    reviews: reviewMap.get(b.id) || []
  }));
}

// FIXED: Single query with JOIN and COUNT
function getAuthorBookCounts(country) {
  return db.prepare(`
    SELECT a.*, COUNT(b.id) as bookCount
    FROM authors a
    LEFT JOIN books b ON a.id = b.author_id
    WHERE a.country = ?
    GROUP BY a.id
  `).all(country);
}

module.exports = { getAuthorsWithBooks, getBooksWithDetails, getAuthorBookCounts };
EOF
