FROM node:20-slim

WORKDIR /workspace

RUN apt-get update && apt-get install -y --no-install-recommends bash && rm -rf /var/lib/apt/lists/*

RUN npm init -y && npm install better-sqlite3

# Database setup
RUN cat > db.js << 'DBEOF'
const Database = require('better-sqlite3');
const db = new Database(':memory:');

db.exec(`
  CREATE TABLE authors (id INTEGER PRIMARY KEY, name TEXT, country TEXT);
  CREATE TABLE books (id INTEGER PRIMARY KEY, title TEXT, author_id INTEGER, year INTEGER);
  CREATE TABLE reviews (id INTEGER PRIMARY KEY, book_id INTEGER, rating INTEGER, comment TEXT);
`);

// Insert test data
const insertAuthor = db.prepare('INSERT INTO authors (id, name, country) VALUES (?, ?, ?)');
const insertBook = db.prepare('INSERT INTO books (id, title, author_id, year) VALUES (?, ?, ?, ?)');
const insertReview = db.prepare('INSERT INTO reviews (id, book_id, rating, comment) VALUES (?, ?, ?, ?)');

const authors = [
  [1, 'Alice Smith', 'US'], [2, 'Bob Jones', 'UK'], [3, 'Charlie Brown', 'CA'],
  [4, 'Diana Lee', 'US'], [5, 'Eve Wilson', 'UK']
];
const books = [
  [1, 'Book A', 1, 2020], [2, 'Book B', 1, 2021], [3, 'Book C', 2, 2019],
  [4, 'Book D', 3, 2022], [5, 'Book E', 3, 2023], [6, 'Book F', 4, 2021],
  [7, 'Book G', 5, 2020], [8, 'Book H', 5, 2022]
];
const reviews = [
  [1, 1, 5, 'Great'], [2, 1, 4, 'Good'], [3, 2, 3, 'OK'],
  [4, 3, 5, 'Excellent'], [5, 4, 2, 'Poor'], [6, 5, 4, 'Nice'],
  [7, 6, 3, 'Average'], [8, 7, 5, 'Amazing'], [9, 8, 4, 'Solid']
];

authors.forEach(a => insertAuthor.run(...a));
books.forEach(b => insertBook.run(...b));
reviews.forEach(r => insertReview.run(...r));

module.exports = db;
DBEOF

# App with N+1 queries
RUN cat > app.js << 'APPEOF'
const db = require('./db');

// N+1: Fetches all authors, then queries books for each author
function getAuthorsWithBooks() {
  const authors = db.prepare('SELECT * FROM authors').all();
  for (const author of authors) {
    author.books = db.prepare('SELECT * FROM books WHERE author_id = ?').all(author.id);
  }
  return authors;
}

// N+1: Fetches all books, then queries author and reviews for each
function getBooksWithDetails() {
  const books = db.prepare('SELECT * FROM books').all();
  for (const book of books) {
    book.author = db.prepare('SELECT * FROM authors WHERE id = ?').get(book.author_id);
    book.reviews = db.prepare('SELECT * FROM reviews WHERE book_id = ?').all(book.id);
  }
  return books;
}

// N+1: Gets authors from a country, then counts books for each
function getAuthorBookCounts(country) {
  const authors = db.prepare('SELECT * FROM authors WHERE country = ?').all(country);
  for (const author of authors) {
    const result = db.prepare('SELECT COUNT(*) as count FROM books WHERE author_id = ?').get(author.id);
    author.bookCount = result.count;
  }
  return authors;
}

module.exports = { getAuthorsWithBooks, getBooksWithDetails, getAuthorBookCounts };
APPEOF

# Correctness tests
RUN cat > test_correctness.js << 'TESTEOF'
const { getAuthorsWithBooks, getBooksWithDetails, getAuthorBookCounts } = require('./app');

let passed = 0;
let total = 0;

function assert(condition, msg) {
  total++;
  if (condition) { passed++; console.log(`  PASS: ${msg}`); }
  else { console.log(`  FAIL: ${msg}`); }
}

// Test getAuthorsWithBooks
const authors = getAuthorsWithBooks();
assert(authors.length === 5, 'getAuthorsWithBooks returns 5 authors');
const alice = authors.find(a => a.name === 'Alice Smith');
assert(alice && alice.books && alice.books.length === 2, 'Alice has 2 books');
assert(alice.books[0].title === 'Book A' || alice.books[1].title === 'Book A', 'Alice has Book A');

// Test getBooksWithDetails
const books = getBooksWithDetails();
assert(books.length === 8, 'getBooksWithDetails returns 8 books');
const bookA = books.find(b => b.title === 'Book A');
assert(bookA && bookA.author && bookA.author.name === 'Alice Smith', 'Book A author is Alice');
assert(bookA && bookA.reviews && bookA.reviews.length === 2, 'Book A has 2 reviews');

// Test getAuthorBookCounts
const usAuthors = getAuthorBookCounts('US');
assert(usAuthors.length === 2, 'US has 2 authors');
const aliceCount = usAuthors.find(a => a.name === 'Alice Smith');
assert(aliceCount && aliceCount.bookCount === 2, 'Alice bookCount is 2');

console.log(`\n${passed}/${total} tests passed`);
process.exit(passed === total ? 0 : 1);
TESTEOF

RUN mkdir -p logs/verifier

CMD ["bash"]
