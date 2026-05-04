// ── Config ──────────────────────────────────────────────────────
// Change this password before deploying!
const ADMIN_PASSWORD = 'tamil2024';

// ── State ───────────────────────────────────────────────────────
let manifestData = { fonts: [], generated: '', total: 0 };
let editedFonts = [];   // working copy

// ── Auth ────────────────────────────────────────────────────────
function checkAuth() {
  const gate = document.getElementById('passGate');
  const stored = sessionStorage.getItem('admin_auth');
  if (stored === ADMIN_PASSWORD) { gate.style.display = 'none'; initAdmin(); return; }
  gate.style.display = 'flex';

  document.getElementById('passSubmit').addEventListener('click', tryPass);
  document.getElementById('passInput').addEventListener('keydown', e => { if (e.key === 'Enter') tryPass(); });
}

function tryPass() {
  const val = document.getElementById('passInput').value;
  if (val === ADMIN_PASSWORD) {
    sessionStorage.setItem('admin_auth', val);
    document.getElementById('passGate').style.display = 'none';
    initAdmin();
  } else {
    document.getElementById('passError').textContent = 'Incorrect password.';
    document.getElementById('passInput').value = '';
  }
}

// ── Init Admin ──────────────────────────────────────────────────
async function initAdmin() {
  try {
    const res = await fetch('../fonts.json?' + Date.now());
    manifestData = await res.json();
    editedFonts = JSON.parse(JSON.stringify(manifestData.fonts || []));
  } catch {
    manifestData = { fonts: [], generated: new Date().toISOString(), total: 0 };
    editedFonts = [];
  }
  renderStats();
  renderFontTable();
  setupAdminControls();
}

// ── Stats ────────────────────────────────────────────────────────
function renderStats() {
  const fonts = editedFonts;
  const noMeta = fonts.filter(f => !f.designer && !f.description).length;
  const byLic = {};
  fonts.forEach(f => { const l = normLicense(f.license); byLic[l] = (byLic[l]||0)+1; });

  document.getElementById('statTotal').textContent = fonts.length;
  document.getElementById('statNoMeta').textContent = noMeta;
  document.getElementById('statGenerated').textContent = manifestData.generated ? new Date(manifestData.generated).toLocaleDateString() : '—';
  document.getElementById('statLicenses').innerHTML = Object.entries(byLic).map(([k,v]) => `${k}: <strong>${v}</strong>`).join(' · ') || '—';
}

// ── Font Table ──────────────────────────────────────────────────
const CATS = ['Serif','Sans-Serif','Display','Handwritten','Monospace','Other'];
const LICS = ['OFL','Free','Proprietary','Unknown'];

let tableSearch = '';
let tablePage = 1;
const TABLE_PAGE = 50;

function renderFontTable() {
  const q = tableSearch.toLowerCase();
  const fonts = editedFonts.filter(f =>
    !q || `${f.display_name} ${f.filename} ${f.designer}`.toLowerCase().includes(q)
  );
  const total = Math.ceil(fonts.length / TABLE_PAGE);
  const page = fonts.slice((tablePage-1)*TABLE_PAGE, tablePage*TABLE_PAGE);

  const missing = editedFonts.filter(f => !f.designer || f.license === 'Unknown').length;
  document.getElementById('missingCount').textContent = missing;

  const tbody = document.getElementById('fontTableBody');
  tbody.innerHTML = page.map((f, i) => {
    const realIdx = editedFonts.indexOf(f);
    const hasMeta = f.designer || f.description;
    return `
    <tr>
      <td><span title="${esc(f.filename)}">${esc(f.display_name || f.filename)}</span>
        ${!hasMeta ? '<span class="missing-badge">no meta</span>' : ''}</td>
      <td><input value="${esc(f.family||'')}" onchange="setField(${realIdx},'family',this.value)" placeholder="Family"/></td>
      <td><input value="${esc(f.collection||'')}" onchange="setField(${realIdx},'collection',this.value)" placeholder="e.g. ATM" style="width:70px"/></td>
      <td>
        <select onchange="setField(${realIdx},'category',this.value)" style="background:var(--bg3);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:3px 6px;font-size:12px">
          ${CATS.map(c => `<option ${f.category===c?'selected':''}>${c}</option>`).join('')}
        </select>
      </td>
      <td>
        <select onchange="setField(${realIdx},'license',this.value)" style="background:var(--bg3);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:3px 6px;font-size:12px">
          ${LICS.map(l => `<option ${f.license===l?'selected':''}>${l}</option>`).join('')}
        </select>
      </td>
      <td><input value="${esc(f.designer||'')}" onchange="setField(${realIdx},'designer',this.value)" placeholder="Designer"/></td>
      <td><input value="${esc(f.year||'')}" onchange="setField(${realIdx},'year',this.value)" placeholder="Year" style="width:60px"/></td>
    </tr>`;
  }).join('');

  // Pagination
  let pag = '';
  if (total > 1) {
    pag += `<button class="page-btn" onclick="tblPage(${tablePage-1})" ${tablePage===1?'disabled':''}>‹</button>`;
    pag += `<span class="page-btn" style="cursor:default">${tablePage}/${total}</span>`;
    pag += `<button class="page-btn" onclick="tblPage(${tablePage+1})" ${tablePage===total?'disabled':''}>›</button>`;
  }
  document.getElementById('tablePagination').innerHTML = pag;
}

function tblPage(p) { tablePage = p; renderFontTable(); }
function setField(idx, key, val) { editedFonts[idx][key] = val; }

// ── CSV Import ──────────────────────────────────────────────────
function parseCSV(text) {
  const lines = text.trim().split('\n');
  if (!lines.length) return [];
  const headers = splitCSVLine(lines[0]).map(h => h.trim().toLowerCase());
  return lines.slice(1).map(line => {
    const vals = splitCSVLine(line);
    const obj = {};
    headers.forEach((h, i) => { obj[h] = (vals[i]||'').trim(); });
    return obj;
  }).filter(r => r.filename);
}

function splitCSVLine(line) {
  const result = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { inQ = !inQ; }
    else if (c === ',' && !inQ) { result.push(cur); cur = ''; }
    else { cur += c; }
  }
  result.push(cur);
  return result;
}

function mergeCSV(rows) {
  let added = 0, updated = 0;
  rows.forEach(row => {
    const idx = editedFonts.findIndex(f => f.filename === row.filename);
    const entry = {
      display_name: row.display_name || '',
      family: row.family || '',
      collection: row.collection || '',
      category: row.category || 'Display',
      license: row.license || 'Unknown',
      designer: row.designer || '',
      foundry: row.foundry || '',
      year: row.year || '',
      description: row.description || '',
      tags: row.tags ? row.tags.split(';').map(t=>t.trim()).filter(Boolean) : [],
    };
    if (idx >= 0) { Object.assign(editedFonts[idx], entry); updated++; }
    else {
      editedFonts.push({
        id: slugify(row.filename),
        filename: row.filename,
        added: new Date().toISOString().slice(0,10),
        ...entry
      });
      added++;
    }
  });
  renderStats();
  renderFontTable();
  showAdminToast(`✅ CSV merged: ${updated} updated, ${added} added.`);
}

// ── Export ──────────────────────────────────────────────────────
function exportManifest() {
  const out = {
    generated: new Date().toISOString(),
    total: editedFonts.length,
    fonts: editedFonts,
  };
  const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'fonts.json';
  a.click();
  showAdminToast('✅ fonts.json downloaded! Replace the file in your project and redeploy.');
}

function exportCSVTemplate() {
  const headers = 'filename,display_name,family,collection,category,license,designer,foundry,year,description,tags';
  const rows = editedFonts.map(f =>
    [f.filename, f.display_name||'', f.family||'', f.collection||'', f.category||'', f.license||'', f.designer||'',
     f.foundry||'', f.year||'', f.description||'', (f.tags||[]).join(';')].map(csvEsc).join(',')
  );
  const blob = new Blob([[headers, ...rows].join('\n')], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'fonts_metadata.csv';
  a.click();
}

function csvEsc(v) {
  if (/[,"\n]/.test(v)) return `"${String(v).replace(/"/g,'""')}"`;
  return v;
}

// ── Controls ────────────────────────────────────────────────────
function setupAdminControls() {
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

  // CSV upload zone
  const zone = document.getElementById('csvZone');
  const fileInput = document.getElementById('csvFileInput');

  zone.addEventListener('click', () => fileInput.click());
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('dragover'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
  zone.addEventListener('drop', e => {
    e.preventDefault(); zone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file) readCSVFile(file);
  });
  fileInput.addEventListener('change', () => { if (fileInput.files[0]) readCSVFile(fileInput.files[0]); });

  // Table search
  document.getElementById('tableSearch').addEventListener('input', e => {
    tableSearch = e.target.value;
    tablePage = 1;
    renderFontTable();
  });

  // Buttons
  document.getElementById('exportBtn').addEventListener('click', exportManifest);
  document.getElementById('exportCSVBtn').addEventListener('click', exportCSVTemplate);
}

function readCSVFile(file) {
  if (!file.name.endsWith('.csv') && file.type !== 'text/csv') {
    showAdminToast('⚠️ Please upload a .csv file'); return;
  }
  const reader = new FileReader();
  reader.onload = e => {
    const rows = parseCSV(e.target.result);
    if (!rows.length) { showAdminToast('⚠️ No valid rows found in CSV'); return; }
    showCSVPreview(rows);
  };
  reader.readAsText(file);
}

function showCSVPreview(rows) {
  const preview = document.getElementById('csvPreview');
  preview.innerHTML = `
    <div style="padding:16px;background:var(--bg3);border-radius:var(--radius-sm);margin-top:12px">
      <p style="font-size:13px;color:var(--text2);margin-bottom:10px">Found <strong style="color:var(--text)">${rows.length}</strong> rows. Preview (first 3):</p>
      <table class="font-table" style="margin-bottom:12px">
        <tr><th>Filename</th><th>Name</th><th>Category</th><th>License</th><th>Designer</th></tr>
        ${rows.slice(0,3).map(r=>`<tr><td>${esc(r.filename)}</td><td>${esc(r.display_name)}</td><td>${esc(r.category)}</td><td>${esc(r.license)}</td><td>${esc(r.designer)}</td></tr>`).join('')}
      </table>
      <button class="btn btn-accent" onclick="mergeCSV(window._csvRows)">✅ Apply ${rows.length} rows</button>
      <button class="btn btn-ghost" onclick="document.getElementById('csvPreview').innerHTML=''" style="margin-left:8px">Cancel</button>
    </div>`;
  window._csvRows = rows;
}

// ── Utils ────────────────────────────────────────────────────────
function normLicense(l='') {
  l = l.toLowerCase();
  if (l.includes('ofl')||l.includes('open')) return 'OFL';
  if (l.includes('free')) return 'Free';
  if (l.includes('prop')) return 'Proprietary';
  return 'Unknown';
}

function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').replace(/\.[^.]+$/,'');
}

function esc(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function showAdminToast(msg) {
  const t = document.getElementById('adminToast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 4000);
}

checkAuth();
