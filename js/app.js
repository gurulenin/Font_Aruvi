/* Tamil text samples for preview modes */
const PREVIEW_SAMPLES = {
  sentence: 'தமிழ் மொழி உலகின் பழமையான மொழிகளில் ஒன்றாகும்.',
  alphabet: 'அ ஆ இ ஈ உ ஊ எ ஏ ஐ ஒ ஓ ஔ க ச ட த ந ப ம ய ர ல வ ழ ள ற ன',
  paragraph: 'தமிழ் மொழி இந்தியாவிலும் இலங்கையிலும் சிங்கப்பூரிலும் பேசப்படுகிறது. இது திராவிட மொழிக் குடும்பத்தில் மிகவும் பழமையான மொழியாகும். தமிழ் இலக்கியம் சங்க காலத்திலிருந்து தொடர்கிறது.',
  numerals: '௦ ௧ ௨ ௩ ௪ ௫ ௬ ௭ ௮ ௯ 0 1 2 3 4 5 6 7 8 9',
};

const TAMIL_VOWELS = ['அ','ஆ','இ','ஈ','உ','ஊ','எ','ஏ','ஐ','ஒ','ஓ','ஔ'];
const TAMIL_CONSONANTS = ['க','ங','ச','ஞ','ட','ண','த','ந','ப','ம','ய','ர','ல','வ','ழ','ள','ற','ன'];
const TAMIL_NUMERALS = ['௦','௧','௨','௩','௪','௫','௬','௭','௮','௯'];

const PAGE_SIZE = 36;
let allFonts = [];
let filtered = [];
let currentPage = 1;
let viewMode = 'grid';
let previewText = PREVIEW_SAMPLES.sentence;
let previewSize = 28;
let loadedFonts = new Set();
let activeFont = null;

// Filters state
let filters = { search: '', category: '', license: '', collection: '', sort: 'name' };

/* ── Bootstrap ── */
async function init() {
  renderSkeletons();
  try {
    const res = await fetch('fonts.json?' + Date.now());
    const data = await res.json();
    allFonts = data.fonts || [];
    buildCollectionChips();
    applyFilters();
  } catch (e) {
    document.getElementById('fontsGrid').innerHTML =
      `<div class="empty-state"><div class="icon">⚠️</div><h3>fonts.json not found</h3>
       <p>Run <code>./generate-manifest.sh > fonts.json</code> to generate it.</p></div>`;
  }
  setupControls();
}

/* ── Skeletons ── */
function renderSkeletons(n = 12) {
  const g = document.getElementById('fontsGrid');
  g.innerHTML = Array(n).fill('<div class="skeleton"></div>').join('');
}

/* ── Filter & Sort ── */
function applyFilters() {
  const { search, category, license, collection, sort } = filters;
  const q = search.toLowerCase();
  filtered = allFonts.filter(f => {
    if (q && !`${f.display_name} ${f.family} ${f.designer} ${f.tags?.join(' ')||''}`.toLowerCase().includes(q)) return false;
    if (category && f.category !== category) return false;
    if (license && normLicense(f.license) !== license) return false;
    if (collection && (f.collection || '') !== collection) return false;
    return true;
  });
  if (sort === 'name') filtered.sort((a,b) => (a.display_name||'').localeCompare(b.display_name||''));
  else if (sort === 'newest') filtered.sort((a,b) => (b.added||'').localeCompare(a.added||''));
  else if (sort === 'category') filtered.sort((a,b) => (a.category||'').localeCompare(b.category||''));
  currentPage = 1;
  renderPage();
  updateCount();
}

/* ── Build Collection Chips ── */
function buildCollectionChips() {
  const section = document.getElementById('collectionSection');
  const chipsEl = document.getElementById('collectionChips');
  const countEl = document.getElementById('collectionCount');
  if (!section || !chipsEl) return;

  const collections = [...new Set(allFonts.map(f => f.collection || '').filter(Boolean))].sort();
  if (!collections.length) return;

  section.style.display = '';
  countEl.textContent = collections.length + ' groups';

  chipsEl.innerHTML = `<button class="filter-chip active" data-col="">All</button>` +
    collections.map(c => {
      const count = allFonts.filter(f => f.collection === c).length;
      return `<button class="filter-chip" data-col="${esc(c)}">${esc(c)} <span style="opacity:0.5;font-size:10px">${count}</span></button>`;
    }).join('');

  chipsEl.querySelectorAll('[data-col]').forEach(el => {
    el.addEventListener('click', () => {
      chipsEl.querySelectorAll('[data-col]').forEach(c => c.classList.remove('active'));
      el.classList.add('active');
      filters.collection = el.dataset.col;
      applyFilters();
    });
  });
}

function normLicense(l='') {
  l = l.toLowerCase();
  if (l.includes('ofl') || l.includes('open')) return 'OFL';
  if (l.includes('free')) return 'Free';
  if (l.includes('prop')) return 'Proprietary';
  return 'Unknown';
}

function updateCount() {
  document.getElementById('fontCount').textContent = filtered.length;
  document.getElementById('totalCount').textContent = allFonts.length;
}

/* ── Render page ── */
function renderPage() {
  const start = (currentPage - 1) * PAGE_SIZE;
  const page = filtered.slice(start, start + PAGE_SIZE);
  const grid = document.getElementById('fontsGrid');
  grid.className = viewMode === 'list' ? 'list-view' : '';

  if (!filtered.length) {
    grid.innerHTML = `<div class="empty-state"><div class="icon">🔍</div><h3>No fonts found</h3><p>Try adjusting your search or filters.</p></div>`;
    document.getElementById('pagination').innerHTML = '';
    return;
  }

  grid.innerHTML = page.map(font => buildCard(font)).join('');

  // Lazy-load fonts via IntersectionObserver
  const observer = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        const id = e.target.dataset.fontId;
        const font = allFonts.find(f => f.id === id);
        if (font) loadFont(font, e.target);
        observer.unobserve(e.target);
      }
    });
  }, { rootMargin: '100px' });

  grid.querySelectorAll('.font-card').forEach(card => observer.observe(card));

  // Download button events (stop propagation)
  grid.querySelectorAll('.download-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const id = btn.closest('.font-card').dataset.fontId;
      const font = allFonts.find(f => f.id === id);
      if (font) downloadFont(font);
    });
  });

  // Card click → modal
  grid.querySelectorAll('.font-card').forEach(card => {
    card.addEventListener('click', () => {
      const id = card.dataset.fontId;
      const font = allFonts.find(f => f.id === id);
      if (font) openModal(font);
    });
  });

  renderPagination();
}

function buildCard(font) {
  const lic = normLicense(font.license);
  const licClass = { OFL:'badge-ofl', Free:'badge-free', Proprietary:'badge-prop', Unknown:'badge-unk' }[lic] || 'badge-unk';
  return `
  <div class="font-card" data-font-id="${font.id}">
    <div class="card-header">
      <div>
        <div class="card-name">${esc(font.display_name || font.filename)}</div>
        <div class="card-family">${[font.collection ? `<span class="coll-tag">${esc(font.collection)}</span>` : '', font.designer ? esc(font.designer) : ''].filter(Boolean).join(' · ')}</div>
      </div>
      <span class="badge ${licClass}">${lic}</span>
    </div>
    <div class="card-preview loading" data-preview>Loading…</div>
    <div class="card-footer">
      <div class="card-meta">
        ${font.category ? `<span>${esc(font.category)}</span>` : ''}
        ${font.year ? `<span>${esc(font.year)}</span>` : ''}
      </div>
      <button class="download-btn">⬇ Download</button>
    </div>
  </div>`;
}

/* ── Font loading ── */
function loadFont(font, cardEl) {
  const fontKey = font.id;
  const preview = cardEl.querySelector('[data-preview]');
  if (!preview) return;

  if (!loadedFonts.has(fontKey)) {
    loadedFonts.add(fontKey);
    const face = new FontFace(fontKey, `url(fonts/${encodeURIComponent(font.filename)})`);
    face.load().then(f => {
      document.fonts.add(f);
      applyPreviewToEl(preview, fontKey);
    }).catch(() => {
      preview.textContent = '⚠ Font load error';
      preview.classList.remove('loading');
    });
  } else {
    applyPreviewToEl(preview, fontKey);
  }
}

function applyPreviewToEl(el, fontKey) {
  el.style.fontFamily = `"${fontKey}", serif`;
  el.style.fontSize = previewSize + 'px';
  el.textContent = previewText;
  el.classList.remove('loading');
}

function refreshPreviews() {
  document.querySelectorAll('[data-preview]').forEach(el => {
    el.style.fontSize = previewSize + 'px';
    if (!el.classList.contains('loading')) el.textContent = previewText;
  });
}

/* ── Pagination ── */
function renderPagination() {
  const total = Math.ceil(filtered.length / PAGE_SIZE);
  if (total <= 1) { document.getElementById('pagination').innerHTML = ''; return; }
  let html = `<button class="page-btn" onclick="goPage(${currentPage-1})" ${currentPage===1?'disabled':''}>‹</button>`;
  const range = pageRange(currentPage, total);
  range.forEach(p => {
    if (p === '…') html += `<span class="page-btn" style="cursor:default">…</span>`;
    else html += `<button class="page-btn ${p===currentPage?'active':''}" onclick="goPage(${p})">${p}</button>`;
  });
  html += `<button class="page-btn" onclick="goPage(${currentPage+1})" ${currentPage===total?'disabled':''}>›</button>`;
  document.getElementById('pagination').innerHTML = html;
}

function pageRange(cur, total) {
  if (total <= 7) return Array.from({length:total},(_,i)=>i+1);
  const r = [1];
  if (cur > 3) r.push('…');
  for (let i=Math.max(2,cur-1); i<=Math.min(total-1,cur+1); i++) r.push(i);
  if (cur < total-2) r.push('…');
  r.push(total);
  return r;
}

function goPage(p) {
  const total = Math.ceil(filtered.length / PAGE_SIZE);
  if (p < 1 || p > total) return;
  currentPage = p;
  renderPage();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ── Modal ── */
function openModal(font) {
  activeFont = font;
  const m = document.getElementById('fontModal');
  document.getElementById('modalTitle').textContent = font.display_name || font.filename;
  document.getElementById('modalSubtitle').textContent = [font.family, font.designer, font.foundry].filter(Boolean).join(' · ');
  document.getElementById('modalPreviewText').value = previewText;
  document.getElementById('modalSizeSlider').value = previewSize;

  // Load font for modal
  const fontKey = font.id;
  const previewBox = document.getElementById('modalPreviewBox');
  previewBox.textContent = previewText;
  previewBox.style.fontSize = previewSize + 'px';

  if (!loadedFonts.has(fontKey)) {
    const face = new FontFace(fontKey, `url(fonts/${encodeURIComponent(font.filename)})`);
    face.load().then(f => { document.fonts.add(f); loadedFonts.add(fontKey); previewBox.style.fontFamily = `"${fontKey}", serif`; });
  } else {
    previewBox.style.fontFamily = `"${fontKey}", serif`;
  }

  // Meta
  const lic = normLicense(font.license);
  const licClass = { OFL:'badge-ofl', Free:'badge-free', Proprietary:'badge-prop', Unknown:'badge-unk' }[lic] || 'badge-unk';
  document.getElementById('modalMeta').innerHTML = [
    ['Category', font.category || '—'],
    ['License', `<span class="badge ${licClass}">${lic}</span>`],
    ['Designer', font.designer || '—'],
    ['Foundry', font.foundry || '—'],
    ['Year', font.year || '—'],
    ['File', font.filename],
  ].map(([k,v]) => `<div class="meta-item"><div class="meta-item-label">${k}</div><div class="meta-item-value">${v}</div></div>`).join('');

  // Glyphs
  document.getElementById('vowelGlyphs').innerHTML = TAMIL_VOWELS.map(g => `<div class="glyph" style="font-family:'${fontKey}'">${g}</div>`).join('');
  document.getElementById('consonantGlyphs').innerHTML = TAMIL_CONSONANTS.map(g => `<div class="glyph" style="font-family:'${fontKey}'">${g}</div>`).join('');
  document.getElementById('numeralGlyphs').innerHTML = TAMIL_NUMERALS.map(g => `<div class="glyph" style="font-family:'${fontKey}'">${g}</div>`).join('');

  document.getElementById('modalDownloadBtn').onclick = () => downloadFont(font);
  m.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  document.getElementById('fontModal').classList.remove('open');
  document.body.style.overflow = '';
  activeFont = null;
}

/* ── Download ── */
function downloadFont(font) {
  const a = document.createElement('a');
  a.href = `fonts/${encodeURIComponent(font.filename)}`;
  a.download = font.filename;
  a.click();
  showToast(`Downloading ${font.display_name || font.filename}…`);
}

/* ── Toast ── */
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

/* ── Controls setup ── */
function setupControls() {
  // Theme Toggle
  const themeBtn = document.getElementById('themeToggleBtn');
  if (themeBtn) {
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    themeBtn.textContent = isLight ? '🌙' : '☀️';
    themeBtn.addEventListener('click', () => {
      const isNowLight = document.documentElement.getAttribute('data-theme') === 'light';
      if (isNowLight) {
        document.documentElement.removeAttribute('data-theme');
        localStorage.setItem('theme', 'dark');
        themeBtn.textContent = '☀️';
      } else {
        document.documentElement.setAttribute('data-theme', 'light');
        localStorage.setItem('theme', 'light');
        themeBtn.textContent = '🌙';
      }
    });
  }

  // Search
  document.getElementById('searchInput').addEventListener('input', e => {
    filters.search = e.target.value;
    applyFilters();
  });

  // Category chips
  document.querySelectorAll('[data-cat]').forEach(el => {
    el.addEventListener('click', () => {
      document.querySelectorAll('[data-cat]').forEach(c => c.classList.remove('active'));
      filters.category = el.dataset.cat;
      el.classList.add('active');
      applyFilters();
    });
  });

  // License chips
  document.querySelectorAll('[data-lic]').forEach(el => {
    el.addEventListener('click', () => {
      document.querySelectorAll('[data-lic]').forEach(c => c.classList.remove('active'));
      filters.license = el.dataset.lic;
      el.classList.add('active');
      applyFilters();
    });
  });

  // Preview modes
  document.querySelectorAll('[data-mode]').forEach(el => {
    el.addEventListener('click', () => {
      document.querySelectorAll('[data-mode]').forEach(m => m.classList.remove('active'));
      el.classList.add('active');
      const mode = el.dataset.mode;
      if (mode !== 'custom') {
        previewText = PREVIEW_SAMPLES[mode] || PREVIEW_SAMPLES.sentence;
        document.getElementById('previewTextInput').value = previewText;
      }
      refreshPreviews();
    });
  });

  // Custom preview text
  document.getElementById('previewTextInput').addEventListener('input', e => {
    previewText = e.target.value || PREVIEW_SAMPLES.sentence;
    document.querySelectorAll('[data-mode]').forEach(m => m.classList.remove('active'));
    document.querySelector('[data-mode="custom"]')?.classList.add('active');
    refreshPreviews();
  });

  // Size slider
  const slider = document.getElementById('sizeSlider');
  const sizeVal = document.getElementById('sizeValue');
  slider.addEventListener('input', () => {
    previewSize = +slider.value;
    sizeVal.textContent = previewSize + 'px';
    const pct = ((previewSize - +slider.min) / (+slider.max - +slider.min) * 100).toFixed(1);
    slider.style.setProperty('--pct', pct + '%');
    refreshPreviews();
  });

  // Sort
  document.getElementById('sortSelect').addEventListener('change', e => {
    filters.sort = e.target.value;
    applyFilters();
  });

  // View toggle
  document.getElementById('gridViewBtn').addEventListener('click', () => {
    viewMode = 'grid';
    document.getElementById('gridViewBtn').classList.add('active');
    document.getElementById('listViewBtn').classList.remove('active');
    renderPage();
  });
  document.getElementById('listViewBtn').addEventListener('click', () => {
    viewMode = 'list';
    document.getElementById('listViewBtn').classList.add('active');
    document.getElementById('gridViewBtn').classList.remove('active');
    renderPage();
  });

  // Modal close
  document.getElementById('modalClose').addEventListener('click', closeModal);
  document.getElementById('fontModal').addEventListener('click', e => { if (e.target === e.currentTarget) closeModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

  // Modal preview controls
  document.getElementById('modalPreviewText').addEventListener('input', e => {
    const t = e.target.value || previewText;
    document.getElementById('modalPreviewBox').textContent = t;
  });
  document.getElementById('modalSizeSlider').addEventListener('input', e => {
    document.getElementById('modalPreviewBox').style.fontSize = e.target.value + 'px';
    document.getElementById('modalSizeValue').textContent = e.target.value + 'px';
  });

  // Mobile sidebar toggle
  document.getElementById('sidebarToggle')?.addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
  });

  // Collection chips are wired up in buildCollectionChips() after data loads
}

function esc(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

init();
