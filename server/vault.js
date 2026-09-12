const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');

const ROOT = path.join(__dirname, '..');
const BIBLIOTECA_DIR = path.join(ROOT, 'Biblioteca');
const ARCHIVERO_DIR = path.join(ROOT, 'Archivero');
const COVERS_DIR = path.join(ROOT, 'Covers');

function ensureDirs() {
  [BIBLIOTECA_DIR, ARCHIVERO_DIR, COVERS_DIR].forEach((dir) => fs.mkdirSync(dir, { recursive: true }));
}

function slugify(text) {
  return (
    (text || '')
      .toString()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-+|-+$)/g, '') || 'item'
  );
}

function uniqueSlug(base, existing) {
  let slug = base;
  let n = 2;
  while (existing.has(slug)) slug = `${base}-${n++}`;
  return slug;
}

// A cover value in frontmatter is either an external URL, a vault-relative
// path into Covers/ (as Obsidian would store it), or empty.
function resolveCoverUrl(cover) {
  if (!cover) return '';
  if (/^https?:\/\//i.test(cover)) return cover;
  return '/covers/' + cover.replace(/^Covers\//i, '').replace(/^\/+/, '');
}

function readBook(slug) {
  const file = path.join(BIBLIOTECA_DIR, `${slug}.md`);
  if (!fs.existsSync(file)) return null;
  const parsed = matter(fs.readFileSync(file, 'utf-8'));
  return {
    id: slug,
    originalTitle: parsed.data.title || slug,
    author: parsed.data.author || 'Autor desconocido',
    originalLanguage: parsed.data.originalLanguage || '',
    description: parsed.content.trim()
  };
}

function readEditions(bookSlug) {
  const dir = path.join(ARCHIVERO_DIR, bookSlug);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => {
      const slug = f.replace(/\.md$/, '');
      const parsed = matter(fs.readFileSync(path.join(dir, f), 'utf-8'));
      const d = parsed.data;
      return {
        id: `${bookSlug}/${slug}`,
        slug,
        title: d.title || '',
        publisher: d.publisher || '',
        country: d.country || '',
        language: d.language || '',
        year: d.year || null,
        coverUrl: resolveCoverUrl(d.cover),
        editorialDesign: d.editorialDesign || '',
        illustrator: d.illustrator || '',
        illustratorUrl: d.illustratorUrl || '',
        sourceLink: d.sourceLink || '',
        sourceSite: d.sourceSite || ''
      };
    })
    .sort((a, b) => a.slug.localeCompare(b.slug));
}

function listBookSlugs() {
  ensureDirs();
  return fs
    .readdirSync(BIBLIOTECA_DIR)
    .filter((f) => f.endsWith('.md'))
    .map((f) => f.replace(/\.md$/, ''));
}

function getAllBooks() {
  return listBookSlugs()
    .map((slug) => {
      const book = readBook(slug);
      if (!book) return null;
      book.editions = readEditions(slug);
      return book;
    })
    .filter((b) => b && b.editions.length > 0);
}

function getBook(slug) {
  const book = readBook(slug);
  if (!book) return null;
  book.editions = readEditions(slug);
  return book;
}

function writeBookNote(slug, { originalTitle, author, originalLanguage, description }) {
  const content = matter.stringify(description || '', {
    title: originalTitle,
    author: author || 'Autor desconocido',
    originalLanguage: originalLanguage || ''
  });
  fs.writeFileSync(path.join(BIBLIOTECA_DIR, `${slug}.md`), content);
}

function writeEditionNote(bookSlug, editionSlug, fields) {
  const dir = path.join(ARCHIVERO_DIR, bookSlug);
  fs.mkdirSync(dir, { recursive: true });
  const content = matter.stringify('', {
    book: bookSlug,
    title: fields.title,
    publisher: fields.publisher,
    country: fields.country,
    language: fields.language,
    year: fields.year || '',
    cover: fields.cover || '',
    editorialDesign: fields.editorialDesign || '',
    illustrator: fields.illustrator || '',
    illustratorUrl: fields.illustratorUrl || '',
    sourceLink: fields.sourceLink || '',
    sourceSite: fields.sourceSite || ''
  });
  fs.writeFileSync(path.join(dir, `${editionSlug}.md`), content);
}

function saveCoverFile(bookSlug, editionSlug, buffer, ext) {
  const dir = path.join(COVERS_DIR, bookSlug);
  fs.mkdirSync(dir, { recursive: true });
  const relPath = path.join('Covers', bookSlug, `${editionSlug}.${ext}`);
  fs.writeFileSync(path.join(ROOT, relPath), buffer);
  return relPath.split(path.sep).join('/');
}

module.exports = {
  ensureDirs,
  slugify,
  uniqueSlug,
  listBookSlugs,
  getAllBooks,
  getBook,
  writeBookNote,
  writeEditionNote,
  saveCoverFile,
  COVERS_DIR
};
