# Font Aruvi 🔤

> Browse, preview, and download 1500+ Tamil fonts — hosted on Netlify.

## Project Structure

```
font-pre/
├── index.html              # Main browse page
├── admin.html              # Admin panel (password protected)
├── css/style.css           # Design system
├── js/app.js               # Browse page logic
├── js/admin.js             # Admin panel logic
├── fonts/                  # ← Put all your font files here (flat)
├── fonts.json              # Font manifest (generated/maintained)
├── generate-manifest.sh    # One-time scan script
└── netlify.toml            # Netlify config (caching, headers)
```

## Quick Start

### 1. Add your fonts
```bash
cp /path/to/your/fonts/*.{ttf,otf,woff2} fonts/
```

### 2. Generate the initial manifest
```bash
python3 generate-manifest.py
# With --merge to keep existing metadata:
python3 generate-manifest.py --merge
```

### 3. Preview locally
```bash
python3 -m http.server 8080
# Open http://localhost:8080
```

### 4. Add metadata via Admin Panel
- Open `http://localhost:8080/admin.html`
- Default password: **`tamil2024`** (change in `js/admin.js` → `ADMIN_PASSWORD`)
- Upload a CSV or edit inline
- Click **Export fonts.json** → replace the file

### 5. Deploy to Netlify
```bash
git init
git add .
git commit -m "Initial Font Aruvi"
# Push to GitHub, then connect repo to Netlify
```

---

## Admin Panel — CSV Format

Upload a CSV with any of these columns (all optional except `filename`):

| Column | Description | Example |
|--------|-------------|---------|
| `filename` | **Required** — must match file in fonts/ | `NotoSerifTamil-Regular.ttf` |
| `display_name` | Font display name | `Noto Serif Tamil` |
| `family` | Font family | `Noto Serif Tamil` |
| `category` | Serif, Sans-Serif, Display, Handwritten, Monospace, Other | `Serif` |
| `license` | OFL, Free, Proprietary, Unknown | `OFL` |
| `designer` | Designer name | `Google` |
| `foundry` | Foundry/publisher | `Google` |
| `year` | Year created | `2020` |
| `description` | Short description | `Classic Tamil serif` |
| `tags` | Semicolon-separated tags | `serif;google;classic` |

### Example CSV
```csv
filename,display_name,family,category,license,designer,foundry,year,description,tags
NotoSerifTamil-Regular.ttf,Noto Serif Tamil,Noto Serif Tamil,Serif,OFL,Google,Google,2020,A beautiful Tamil serif font,serif;google
Latha.ttf,Latha,Latha,Sans-Serif,Free,Microsoft,Microsoft,2001,Windows Tamil font,sans;microsoft;system
```

---

## Workflow for Adding New Fonts

1. Copy new `.ttf`/`.otf`/`.woff2` files into `fonts/`
2. Re-run `./generate-manifest.sh > fonts.json` (or use `--merge` to keep existing metadata)
3. Open admin panel → upload CSV with new font metadata
4. Export `fonts.json` → replace file → git push → Netlify deploys

---

## Customisation

| File | What to change |
|------|---------------|
| `js/admin.js` line 2 | `ADMIN_PASSWORD` |
| `index.html` | Brand name, nav links |
| `css/style.css` | Colors (`--accent`, `--bg`, etc.) |
| `js/app.js` | Preview text samples (`PREVIEW_SAMPLES`) |

---

## Netlify Setup

1. Push repo to GitHub
2. Go to [netlify.com](https://netlify.com) → **New site from Git**
3. Build command: *(leave empty — static site)*
4. Publish directory: `.` (root)
5. Add custom domain in **Domain Management**

Fonts are cached for 1 year automatically via `netlify.toml`.
