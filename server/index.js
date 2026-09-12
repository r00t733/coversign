const express = require('express');
const multer = require('multer');
const path = require('path');
const { fetch: undiciFetch, ProxyAgent } = require('undici');
const vault = require('./vault');

// Si el servidor corre detrás de un proxy HTTP(S) (frecuente en redes
// corporativas), lo usamos para las consultas salientes a la API de
// autocompletado; si no hay proxy configurado, se conecta directo.
const PROXY_URL = process.env.HTTPS_PROXY || process.env.https_proxy || '';
const proxyAgent = PROXY_URL ? new ProxyAgent(PROXY_URL) : undefined;

function fetchExternal(url) {
  return undiciFetch(url, proxyAgent ? { dispatcher: proxyAgent } : undefined);
}

const app = express();
const PORT = process.env.PORT || 3000;

vault.ensureDirs();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 }
});

const EXT_BY_MIME = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif'
};

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/covers', express.static(vault.COVERS_DIR));

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

// Las ediciones ya aportadas son inmutables: nadie puede editar su
// información ni reemplazar su imagen. Si los datos nuevos describen la
// misma edición (misma editorial, país y año) que una ya existente, se
// rechaza en vez de sobrescribirla.
function findConflictingEdition(book, body) {
  const country = vault.slugify(body.country);
  const publisher = vault.slugify(body.publisher);
  const year = body.year ? Number(body.year) : null;
  return book.editions.find(
    (e) => vault.slugify(e.country) === country && vault.slugify(e.publisher) === publisher && (e.year || null) === year
  );
}

function resolveCover(req, bookSlug, editionSlug) {
  if (req.file) {
    const ext = EXT_BY_MIME[req.file.mimetype];
    if (!ext) return { error: 'La imagen debe ser JPG, PNG, WEBP o GIF.' };
    return { cover: vault.saveCoverFile(bookSlug, editionSlug, req.file.buffer, ext) };
  }
  if (req.body.coverUrl && String(req.body.coverUrl).trim()) {
    return { cover: String(req.body.coverUrl).trim() };
  }
  return { cover: '' };
}

const LANGUAGE_NAMES = {
  en: 'Inglés',
  es: 'Español',
  fr: 'Francés',
  de: 'Alemán',
  it: 'Italiano',
  pt: 'Portugués',
  ja: 'Japonés',
  zh: 'Chino',
  ru: 'Ruso',
  ca: 'Catalán'
};

// Autocompletar por ISBN: consulta la API pública de Google Books y
// normaliza la respuesta a los campos que usa el formulario de aporte.
// Requiere conexión a internet; no funciona sin conexión (a diferencia
// de navegar el catálogo ya visitado, que sí funciona offline).
app.get('/api/lookup', async (req, res) => {
  const isbn = (req.query.isbn || '').replace(/[^0-9Xx]/g, '');
  if (!isbn) return res.status(400).json({ error: 'Indicá un ISBN.' });

  try {
    const apiRes = await fetchExternal(`https://www.googleapis.com/books/v1/volumes?q=isbn:${encodeURIComponent(isbn)}`);
    if (apiRes.status === 429) {
      return res.status(503).json({ error: 'Se alcanzó el límite de consultas a la base de datos de libros. Probá de nuevo en un momento.' });
    }
    if (!apiRes.ok) throw new Error(`La búsqueda respondió con estado ${apiRes.status}.`);
    const data = await apiRes.json();
    const item = data.items && data.items[0];
    if (!item) return res.status(404).json({ error: 'No se encontró ningún libro con ese ISBN.' });

    const info = item.volumeInfo || {};
    const year = info.publishedDate ? parseInt(info.publishedDate.slice(0, 4), 10) : null;

    res.json({
      title: info.title || '',
      author: (info.authors || []).join(', '),
      publisher: info.publisher || '',
      year: Number.isInteger(year) ? year : null,
      language: LANGUAGE_NAMES[info.language] || info.language || '',
      description: (info.description || '').trim(),
      coverUrl: info.imageLinks ? (info.imageLinks.thumbnail || info.imageLinks.smallThumbnail || '').replace('http://', 'https://') : ''
    });
  } catch (err) {
    console.error('Fallo en /api/lookup:', err.message);
    res.status(502).json({ error: 'No se pudo consultar la base de datos de libros. Revisá tu conexión e intentá de nuevo.' });
  }
});

app.get('/api/books', (req, res) => {
  res.json(vault.getAllBooks().map(summarize));
});

app.get('/api/search', (req, res) => {
  const q = (req.query.q || '').trim();
  const books = vault.getAllBooks();
  const results = q ? books.filter((b) => matches(b, q)) : books;
  res.json(results.map(summarize));
});

app.get('/api/books/:id', (req, res) => {
  const book = vault.getBook(req.params.id);
  if (!book) return res.status(404).json({ error: 'Libro no encontrado.' });
  res.json(book);
});

app.post('/api/books', upload.single('coverFile'), (req, res) => {
  const body = req.body || {};
  if (!body.originalTitle || !String(body.originalTitle).trim()) {
    return res.status(400).json({ error: 'El título original es obligatorio.' });
  }
  const editionError = validateEdition(body);
  if (editionError) return res.status(400).json({ error: editionError });

  const existingBookSlugs = new Set(vault.listBookSlugs());
  const bookSlug = vault.uniqueSlug(vault.slugify(body.originalTitle), existingBookSlugs);
  const editionSlug = vault.uniqueSlug(vault.slugify(`${body.country}-${body.publisher}`), new Set());

  const { cover, error } = resolveCover(req, bookSlug, editionSlug);
  if (error) return res.status(400).json({ error });

  vault.writeBookNote(bookSlug, {
    originalTitle: String(body.originalTitle).trim(),
    author: String(body.author || '').trim(),
    originalLanguage: String(body.originalLanguage || body.language || '').trim(),
    description: String(body.description || '').trim()
  });

  vault.writeEditionNote(bookSlug, editionSlug, {
    title: String(body.title).trim(),
    publisher: String(body.publisher).trim(),
    country: String(body.country).trim(),
    language: String(body.language).trim(),
    year: body.year ? Number(body.year) : null,
    cover,
    editorialDesign: String(body.editorialDesign || '').trim(),
    coverArt: String(body.coverArt || '').trim(),
    sourceLink: String(body.sourceLink || '').trim(),
    sourceSite: String(body.sourceSite || '').trim()
  });

  res.status(201).json(vault.getBook(bookSlug));
});

app.post('/api/books/:id/editions', upload.single('coverFile'), (req, res) => {
  const bookSlug = req.params.id;
  const book = vault.getBook(bookSlug);
  if (!book) return res.status(404).json({ error: 'Libro no encontrado.' });

  const body = req.body || {};
  const editionError = validateEdition(body);
  if (editionError) return res.status(400).json({ error: editionError });

  if (findConflictingEdition(book, body)) {
    return res.status(409).json({
      error:
        'Ya existe una edición registrada con esa editorial, país y año. Las ediciones ya aportadas no se pueden editar ni reemplazar su imagen; si tenés datos distintos, aportalos como una edición nueva (por ejemplo, con otro año).'
    });
  }

  const existingEditionSlugs = new Set(book.editions.map((e) => e.slug));
  const editionSlug = vault.uniqueSlug(vault.slugify(`${body.country}-${body.publisher}`), existingEditionSlugs);

  const { cover, error } = resolveCover(req, bookSlug, editionSlug);
  if (error) return res.status(400).json({ error });

  vault.writeEditionNote(bookSlug, editionSlug, {
    title: String(body.title).trim(),
    publisher: String(body.publisher).trim(),
    country: String(body.country).trim(),
    language: String(body.language).trim(),
    year: body.year ? Number(body.year) : null,
    cover,
    editorialDesign: String(body.editorialDesign || '').trim(),
    coverArt: String(body.coverArt || '').trim(),
    sourceLink: String(body.sourceLink || '').trim(),
    sourceSite: String(body.sourceSite || '').trim()
  });

  res.status(201).json(vault.getBook(bookSlug));
});

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: 'La imagen supera el tamaño máximo permitido (8 MB).' });
  }
  next(err);
});

app.listen(PORT, () => {
  console.log(`coversign escuchando en http://localhost:${PORT}`);
});
