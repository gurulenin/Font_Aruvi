#!/usr/bin/env python3
"""
generate-manifest.py
Scans the fonts/ directory and creates fonts.json

Usage:
  python3 generate-manifest.py              # fresh scan → fonts.json
  python3 generate-manifest.py --merge      # merge with existing fonts.json
"""

import os, sys, json, re, datetime
from collections import Counter

FONTS_DIR = "./fonts"
OUTPUT    = "./fonts.json"
MERGE     = "--merge" in sys.argv

FONT_EXTS = {".ttf", ".otf", ".woff2", ".woff"}

def detect_category(name):
    n = name.lower()
    if "serif" in n and "sans" not in n: return "Serif"
    if "sans" in n:  return "Sans-Serif"
    if any(x in n for x in ("mono","code","courier")): return "Monospace"
    if any(x in n for x in ("hand","script","cursive")): return "Handwritten"
    return "Display"

def clean_name(filename):
    stem = os.path.splitext(filename)[0]
    return re.sub(r'[\-_]+', ' ', stem).strip()

def slugify(filename):
    stem = os.path.splitext(filename)[0]
    s = stem.lower()
    s = re.sub(r'[^a-z0-9]+', '-', s)
    return s.strip('-')

def detect_collection(filename):
    """
    Extract a collection prefix from the filename.
    e.g. 'ATM 001_7.ttf' → 'ATM'
         'NotoSerifTamil-Regular.ttf' → 'NotoSerifTamil' (first camel/word segment)
         'Tab-Bold.ttf' → 'Tab'
    Strategy: take all leading alphabetic characters before the first digit.
    """
    stem = os.path.splitext(filename)[0]
    # Strip spaces/hyphens/underscores from start, then grab leading alpha
    clean = re.sub(r'^[\s\-_]+', '', stem)
    m = re.match(r'^([A-Za-z]+)', clean)
    if m:
        return m.group(1).upper()
    return ""

if not os.path.isdir(FONTS_DIR):
    print("❌  fonts/ directory not found!", file=sys.stderr)
    sys.exit(1)

# Load existing if merging
existing = {}
if MERGE and os.path.isfile(OUTPUT):
    try:
        with open(OUTPUT, encoding='utf-8') as f:
            data = json.load(f)
        for font in data.get("fonts", []):
            existing[font["filename"]] = font
        print(f"🔀  Merge mode: loaded {len(existing)} existing entries", file=sys.stderr)
    except Exception as e:
        print(f"⚠️  Could not load existing fonts.json: {e}", file=sys.stderr)

# --- First pass: collect all filenames to count collection sizes ---
all_files = sorted([
    f for f in os.listdir(FONTS_DIR)
    if os.path.splitext(f)[1].lower() in FONT_EXTS
])

# Count occurrences of each collection prefix
prefix_counts = Counter(detect_collection(f) for f in all_files)

# A collection is valid only if 2+ fonts share the same prefix
def get_collection(filename):
    prefix = detect_collection(filename)
    if prefix and prefix_counts[prefix] >= 2:
        return prefix
    return ""

# --- Second pass: build font entries ---
today = datetime.date.today().isoformat()
fonts = []

for filename in all_files:
    if MERGE and filename in existing:
        # Keep existing entry but backfill collection if missing
        entry = dict(existing[filename])
        if "collection" not in entry:
            entry["collection"] = get_collection(filename)
        fonts.append(entry)
    else:
        fonts.append({
            "id":           slugify(filename),
            "filename":     filename,
            "display_name": clean_name(filename),
            "family":       clean_name(filename),
            "category":     detect_category(filename),
            "collection":   get_collection(filename),
            "license":      "Unknown",
            "designer":     "",
            "foundry":      "",
            "year":         "",
            "description":  "",
            "tags":         [],
            "added":        today,
        })

# Report collections found
collections = sorted(set(f["collection"] for f in fonts if f["collection"]))
print(f"📦  Collections detected ({len(collections)}): {', '.join(collections[:10])}{'...' if len(collections)>10 else ''}", file=sys.stderr)

manifest = {
    "generated": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    "total": len(fonts),
    "fonts": fonts,
}

with open(OUTPUT, "w", encoding="utf-8") as f:
    json.dump(manifest, f, ensure_ascii=False, indent=2)

print(f"✅  Done! Found {len(fonts)} fonts → {OUTPUT}", file=sys.stderr)
