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
  const detailDesignEl = document.getElementById('detail-design');
  const detailDescriptionEl = document.getElementById('detail-description');
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
        wrapper.classList.add('cover-placeholder');
        wrapper.textContent = title;
      });
      wrapper.appendChild(img);
    } else {
      wrapper.classList.add('cover-placeholder');
      wrapper.textContent = title;
    }
    return wrapper;
  }

  function debounce(fn, delay) {
    let timer = null;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }

  // ---------- grid ----------

  function renderGrid(books) {
    gridEl.innerHTML = '';
    emptyStateEl.hidden = books.length > 0;

    books.forEach((book) => {
      const card = document.createElement('article');
      card.className = 'card';
      card.tabIndex = 0;
      card.dataset.bookId = book.id;

      card.appendChild(createCoverEl(book.featured.coverUrl, book.featured.title));

      const titleEl = document.createElement('p');
      titleEl.className = 'card-title';
      titleEl.textContent = book.originalTitle;

      const authorEl = document.createElement('p');
      authorEl.className = 'card-author';
      authorEl.textContent = book.author;

      card.append(titleEl, authorEl);
      card.addEventListener('click', () => openDetail(book.id));
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openDetail(book.id);
        }
      });
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

    if (edition.designNotes) {
      detailDesignEl.hidden = false;
      detailDesignEl.textContent = `Diseño de portada: ${edition.designNotes}`;
    } else {
      detailDesignEl.hidden = true;
      detailDesignEl.textContent = '';
    }

    detailDescriptionEl.textContent = edition.description || 'Sin descripción disponible para esta edición.';

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

    const formData = new FormData(contributeForm);
    const payload = {
      title: (formData.get('title') || '').trim(),
      publisher: (formData.get('publisher') || '').trim(),
      country: (formData.get('country') || '').trim(),
      language: (formData.get('language') || '').trim(),
      year: formData.get('year') || '',
      coverUrl: (formData.get('coverUrl') || '').trim(),
      description: (formData.get('description') || '').trim(),
      designNotes: (formData.get('designNotes') || '').trim(),
      sourceLink: (formData.get('sourceLink') || '').trim(),
      sourceSite: (formData.get('sourceSite') || '').trim()
    };

    const isNewBook = bookSelect.value === '__new__';

    if (isNewBook) {
      payload.originalTitle = (formData.get('originalTitle') || '').trim();
      payload.author = (formData.get('author') || '').trim();
      payload.originalLanguage = (formData.get('originalLanguage') || '').trim();

      if (!payload.originalTitle) {
        contributeError.textContent = 'El título original es obligatorio para un libro nuevo.';
        contributeError.hidden = false;
        return;
      }
    }

    if (!payload.title || !payload.publisher || !payload.country || !payload.language) {
      contributeError.textContent = 'Completa título, editorial, país e idioma de la edición.';
      contributeError.hidden = false;
      return;
    }

    try {
      const url = isNewBook ? '/api/books' : `/api/books/${encodeURIComponent(bookSelect.value)}/editions`;
      const book = await fetchJSON(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

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
