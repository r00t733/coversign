(() => {
  'use strict';

  const state = {
    allBooks: [],
    currentBook: null,
    currentEditionIndex: 0
  };

  const gridEl = document.getElementById('grid');
  const emptyStateEl = document.getElementById('empty-state');
  const searchInput = document.getElementById('search-input');

  const detailModal = document.getElementById('detail-modal');
  const detailCoverSlot = document.getElementById('detail-cover-slot');
  const detailTitleEl = document.getElementById('detail-title');
  const detailOriginalEl = document.getElementById('detail-original');
  const detailAuthorEl = document.getElementById('detail-author');
  const detailPublisherEl = document.getElementById('detail-publisher');
  const detailCountryEl = document.getElementById('detail-country');
  const detailLanguageEl = document.getElementById('detail-language');
  const detailYearEl = document.getElementById('detail-year');
  const detailDescriptionEl = document.getElementById('detail-description');
  const detailEditorialDesignEl = document.getElementById('detail-editorial-design');
  const detailCoverArtEl = document.getElementById('detail-cover-art');
  const detailSourceEl = document.getElementById('detail-source');
  const detailSourceSiteEl = document.getElementById('detail-source-site');
  const detailEditionsRow = document.getElementById('detail-editions-row');
  const detailEditionsCount = document.getElementById('detail-editions-count');

  const contributeModal = document.getElementById('contribute-modal');
  const contributeForm = document.getElementById('contribute-form');
  const contributeError = document.getElementById('contribute-error');
  const bookSelect = document.getElementById('book-select');
  const newBookFields = document.getElementById('new-book-fields');
  const contributeBtn = document.getElementById('contribute-btn');

  // ---------- helpers ----------

  async function fetchJSON(url, options) {
    const res = await fetch(url, options);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Ocurrió un error.');
    return data;
  }

  function createCoverEl(url, title) {
    const wrapper = document.createElement('div');
    wrapper.className = 'cover';

    if (url) {
      const img = document.createElement('img');
      img.src = url;
      img.alt = `Portada: ${title}`;
      img.loading = 'lazy';
      img.addEventListener('error', () => {
        wrapper.innerHTML = '';
        wrapper.appendChild(placeholderEl(title));
      });
      wrapper.appendChild(img);
    } else {
      wrapper.appendChild(placeholderEl(title));
    }
    return wrapper;
  }

  function placeholderEl(title) {
    const ph = document.createElement('div');
    ph.className = 'cover-placeholder';
    ph.textContent = title;
    return ph;
  }

  function debounce(fn, delay) {
    let timer = null;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }

  // ---------- grid (solo imágenes; el resto se revela al hacer clic) ----------

  function renderGrid(books) {
    gridEl.innerHTML = '';
    emptyStateEl.hidden = books.length > 0;

    books.forEach((book) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'card';
      card.setAttribute('aria-label', `${book.originalTitle} — ${book.author}`);
      card.appendChild(createCoverEl(book.featured.coverUrl, book.featured.title));
      card.addEventListener('click', () => openDetail(book.id));
      gridEl.appendChild(card);
    });
  }

  async function loadAllBooks() {
    state.allBooks = await fetchJSON('/api/books');
    renderGrid(state.allBooks);
  }

  const runSearch = debounce(async (query) => {
    try {
      const results = query ? await fetchJSON(`/api/search?q=${encodeURIComponent(query)}`) : state.allBooks;
      renderGrid(results);
    } catch (err) {
      console.error(err);
    }
  }, 250);

  searchInput.addEventListener('input', () => {
    runSearch(searchInput.value.trim());
  });

  // ---------- detail modal ----------

  async function openDetail(bookId) {
    try {
      const book = await fetchJSON(`/api/books/${encodeURIComponent(bookId)}`);
      showDetail(book, 0);
    } catch (err) {
      alert(err.message);
    }
  }

  function showDetail(book, editionIndex) {
    state.currentBook = book;
    state.currentEditionIndex = editionIndex;
    renderDetail();
    contributeModal.hidden = true;
    detailModal.hidden = false;
  }

  function setNote(el, label, value) {
    if (value) {
      el.hidden = false;
      el.dataset.label = label;
      el.textContent = value;
    } else {
      el.hidden = true;
      el.textContent = '';
    }
  }

  function renderDetail() {
    const book = state.currentBook;
    const edition = book.editions[state.currentEditionIndex];

    detailCoverSlot.innerHTML = '';
    detailCoverSlot.appendChild(createCoverEl(edition.coverUrl, edition.title));

    detailTitleEl.textContent = edition.title;
    detailOriginalEl.textContent = `Título original: ${book.originalTitle}`;

    detailAuthorEl.textContent = book.author || '—';
    detailPublisherEl.textContent = edition.publisher || '—';
    detailCountryEl.textContent = edition.country || '—';
    detailLanguageEl.textContent = edition.language || '—';
    detailYearEl.textContent = edition.year || '—';

    detailDescriptionEl.textContent = book.description || 'Sin descripción disponible para este libro.';

    setNote(detailEditorialDesignEl, 'Diseño editorial', edition.editorialDesign);
    setNote(detailCoverArtEl, 'Diseño de portada / ilustración', edition.coverArt);

    if (edition.sourceLink) {
      detailSourceEl.hidden = false;
      detailSourceEl.href = edition.sourceLink;
    } else {
      detailSourceEl.hidden = true;
      detailSourceEl.removeAttribute('href');
    }
    detailSourceSiteEl.textContent = edition.sourceSite ? `Fuente: ${edition.sourceSite}` : '';

    detailEditionsCount.textContent = `(${book.editions.length})`;
    renderEditionThumbnails(book, state.currentEditionIndex);
  }

  function renderEditionThumbnails(book, activeIndex) {
    detailEditionsRow.innerHTML = '';
    book.editions.forEach((edition, index) => {
      const thumb = document.createElement('button');
      thumb.type = 'button';
      thumb.className = 'edition-thumb' + (index === activeIndex ? ' active' : '');
      thumb.appendChild(createCoverEl(edition.coverUrl, edition.title));

      const label = document.createElement('span');
      label.className = 'edition-thumb-label';
      label.textContent = `${edition.country || '—'}`;
      thumb.appendChild(label);

      thumb.addEventListener('click', () => {
        state.currentEditionIndex = index;
        renderDetail();
      });
      detailEditionsRow.appendChild(thumb);
    });
  }

  document.querySelectorAll('[data-close-detail]').forEach((btn) =>
    btn.addEventListener('click', () => {
      detailModal.hidden = true;
    })
  );

  detailModal.addEventListener('click', (e) => {
    if (e.target === detailModal) detailModal.hidden = true;
  });

  // ---------- contribute modal ----------

  function populateBookSelect() {
    bookSelect.innerHTML = '<option value="__new__">+ Nuevo libro</option>';
    state.allBooks
      .slice()
      .sort((a, b) => a.originalTitle.localeCompare(b.originalTitle))
      .forEach((book) => {
        const opt = document.createElement('option');
        opt.value = book.id;
        opt.textContent = `${book.originalTitle} — ${book.author}`;
        bookSelect.appendChild(opt);
      });
  }

  function toggleNewBookFields() {
    newBookFields.hidden = bookSelect.value !== '__new__';
  }

  bookSelect.addEventListener('change', toggleNewBookFields);

  contributeBtn.addEventListener('click', () => {
    contributeError.hidden = true;
    contributeForm.reset();
    populateBookSelect();
    toggleNewBookFields();
    detailModal.hidden = true;
    contributeModal.hidden = false;
  });

  document.querySelectorAll('[data-close-contribute]').forEach((btn) =>
    btn.addEventListener('click', () => {
      contributeModal.hidden = true;
    })
  );

  contributeModal.addEventListener('click', (e) => {
    if (e.target === contributeModal) contributeModal.hidden = true;
  });

  contributeForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    contributeError.hidden = true;

    const isNewBook = bookSelect.value === '__new__';
    const formData = new FormData(contributeForm);

    if (isNewBook && !formData.get('originalTitle').trim()) {
      contributeError.textContent = 'El título original es obligatorio para un libro nuevo.';
      contributeError.hidden = false;
      return;
    }

    if (!formData.get('title').trim() || !formData.get('publisher').trim() || !formData.get('country').trim() || !formData.get('language').trim()) {
      contributeError.textContent = 'Completa título, editorial, país e idioma de la edición.';
      contributeError.hidden = false;
      return;
    }

    if (!isNewBook) {
      formData.delete('originalTitle');
      formData.delete('author');
      formData.delete('originalLanguage');
      formData.delete('description');
    }

    const coverFile = formData.get('coverFile');
    if (!coverFile || !coverFile.size) formData.delete('coverFile');

    try {
      const url = isNewBook ? '/api/books' : `/api/books/${encodeURIComponent(bookSelect.value)}/editions`;
      const res = await fetch(url, { method: 'POST', body: formData });
      const book = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(book.error || 'Ocurrió un error.');

      await loadAllBooks();
      contributeModal.hidden = true;
      showDetail(book, book.editions.length - 1);
    } catch (err) {
      contributeError.textContent = err.message;
      contributeError.hidden = false;
    }
  });

  // ---------- keyboard ----------

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!detailModal.hidden) detailModal.hidden = true;
    if (!contributeModal.hidden) contributeModal.hidden = true;
  });

  // ---------- init ----------

  loadAllBooks().catch((err) => {
    console.error(err);
    emptyStateEl.hidden = false;
    emptyStateEl.textContent = 'No se pudo cargar el catálogo.';
  });
})();
