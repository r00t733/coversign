const express = require('express');
const path = require('path');
const { readDb, writeDb, slugify, uniqueId } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

function summarize(book) {
  const featured = book.editions[0];
  return {
    id: book.id,
    originalTitle: book.originalTitle,
    author: book.author,
    originalLanguage: book.originalLanguage,
    editionsCount: book.editions.length,
    featured
  };
}

function matches(book, q) {
  const needle = q.toLowerCase();
  if (book.originalTitle.toLowerCase().includes(needle)) return true;
  if ((book.author || '').toLowerCase().includes(needle)) return true;
  return book.editions.some(
    (e) =>
      (e.title || '').toLowerCase().includes(needle) ||
      (e.publisher || '').toLowerCase().includes(needle) ||
      (e.country || '').toLowerCase().includes(needle)
  );
}

const REQUIRED_EDITION_FIELDS = ['title', 'publisher', 'country', 'language'];

function validateEdition(body) {
  for (const field of REQUIRED_EDITION_FIELDS) {
    if (!body[field] || !String(body[field]).trim()) {
      return `El campo "${field}" es obligatorio.`;
    }
  }
  return null;
}

function buildEdition(body, id) {
  return {
    id,
    title: String(body.title).trim(),
    publisher: String(body.publisher).trim(),
    country: String(body.country).trim(),
    language: String(body.language).trim(),
    year: body.year ? Number(body.year) : null,
    coverUrl: String(body.coverUrl || '').trim(),
    description: String(body.description || '').trim(),
    designNotes: String(body.designNotes || '').trim(),
    sourceLink: String(body.sourceLink || '').trim(),
    sourceSite: String(body.sourceSite || '').trim()
  };
}

app.get('/api/books', (req, res) => {
  const db = readDb();
  res.json(db.books.map(summarize));
});

app.get('/api/search', (req, res) => {
  const q = (req.query.q || '').trim();
  const db = readDb();
  const results = q ? db.books.filter((b) => matches(b, q)) : db.books;
  res.json(results.map(summarize));
});

app.get('/api/books/:id', (req, res) => {
  const db = readDb();
  const book = db.books.find((b) => b.id === req.params.id);
  if (!book) return res.status(404).json({ error: 'Libro no encontrado.' });
  res.json(book);
});

app.post('/api/books', (req, res) => {
  const body = req.body || {};
  if (!body.originalTitle || !String(body.originalTitle).trim()) {
    return res.status(400).json({ error: 'El título original es obligatorio.' });
  }
  const editionError = validateEdition(body);
  if (editionError) return res.status(400).json({ error: editionError });

  const db = readDb();
  const existingBookIds = new Set(db.books.map((b) => b.id));
  const bookId = uniqueId(slugify(body.originalTitle), existingBookIds);
  const editionId = uniqueId(slugify(`${bookId}-${body.country}-${body.publisher}`), new Set());

  const book = {
    id: bookId,
    originalTitle: String(body.originalTitle).trim(),
    author: String(body.author || '').trim() || 'Autor desconocido',
    originalLanguage: String(body.originalLanguage || body.language || '').trim(),
    editions: [buildEdition(body, editionId)]
  };

  db.books.push(book);
  writeDb(db);
  res.status(201).json(book);
});

app.post('/api/books/:id/editions', (req, res) => {
  const db = readDb();
  const book = db.books.find((b) => b.id === req.params.id);
  if (!book) return res.status(404).json({ error: 'Libro no encontrado.' });

  const body = req.body || {};
  const editionError = validateEdition(body);
  if (editionError) return res.status(400).json({ error: editionError });

  const existingEditionIds = new Set(book.editions.map((e) => e.id));
  const editionId = uniqueId(slugify(`${book.id}-${body.country}-${body.publisher}`), existingEditionIds);

  book.editions.push(buildEdition(body, editionId));
  writeDb(db);
  res.status(201).json(book);
});

app.listen(PORT, () => {
  console.log(`coversign escuchando en http://localhost:${PORT}`);
});
