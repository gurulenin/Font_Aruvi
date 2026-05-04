#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────
# generate-manifest.sh
# Scans the fonts/ directory and creates/updates fonts.json
# Usage: ./generate-manifest.sh > fonts.json
#        ./generate-manifest.sh --merge > fonts.json (keep existing metadata)
# ─────────────────────────────────────────────────────────────────

set -e

FONTS_DIR="./fonts"
OUTPUT="./fonts.json"
MERGE=false

for arg in "$@"; do
  [[ "$arg" == "--merge" ]] && MERGE=true
done

if [[ ! -d "$FONTS_DIR" ]]; then
  echo "❌  fonts/ directory not found. Create it and add font files." >&2
  exit 1
fi

echo "🔍  Scanning $FONTS_DIR ..." >&2

# Collect existing metadata if merging
declare -A EXISTING_META
if $MERGE && [[ -f "$OUTPUT" ]]; then
  echo "🔀  Merge mode: preserving existing metadata" >&2
  # Extract existing entries as JSON lines using python3
  python3 - <<'PYEOF'
import json, sys
try:
    with open('./fonts.json') as f:
        data = json.load(f)
    for font in data.get('fonts', []):
        print(json.dumps(font))
except Exception as e:
    print(f"# error: {e}", file=sys.stderr)
PYEOF
fi

# Auto-detect category from filename keywords
detect_category() {
  local name="${1,,}"
  if [[ "$name" == *"serif"* && "$name" != *"sans"* ]]; then echo "Serif"
  elif [[ "$name" == *"sans"* ]]; then echo "Sans-Serif"
  elif [[ "$name" == *"mono"* || "$name" == *"code"* || "$name" == *"courier"* ]]; then echo "Monospace"
  elif [[ "$name" == *"hand"* || "$name" == *"script"* || "$name" == *"cursive"* ]]; then echo "Handwritten"
  elif [[ "$name" == *"display"* || "$name" == *"decorative"* || "$name" == *"fancy"* ]]; then echo "Display"
  else echo "Display"
  fi
}

# Clean display name from filename
clean_name() {
  local name="$1"
  # Remove extension
  name="${name%.*}"
  # Replace hyphens/underscores with spaces
  name="${name//-/ }"
  name="${name//_/ }"
  # Remove common suffix patterns: Regular, Bold, Italic, etc.
  echo "$name"
}

TODAY=$(date +%Y-%m-%d)
NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)
COUNT=0

echo "{"
echo "  \"generated\": \"$NOW\","
echo "  \"fonts\": ["

FIRST=true
while IFS= read -r -d '' filepath; do
  filename=$(basename "$filepath")
  ext="${filename##*.}"
  ext_lower="${ext,,}"

  # Only process font files
  [[ "$ext_lower" == "ttf" || "$ext_lower" == "otf" || "$ext_lower" == "woff2" || "$ext_lower" == "woff" ]] || continue

  display_name=$(clean_name "$filename")
  category=$(detect_category "$filename")

  # Generate slug ID
  slug=$(echo "$filename" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/-\+/-/g' | sed 's/^-\|-$//g')
  # Remove extension from slug
  slug="${slug%.*}"

  $FIRST || echo "    ,"
  FIRST=false

  echo "    {"
  echo "      \"id\": \"$slug\","
  echo "      \"filename\": \"$filename\","
  echo "      \"display_name\": \"$display_name\","
  echo "      \"family\": \"$display_name\","
  echo "      \"category\": \"$category\","
  echo "      \"license\": \"Unknown\","
  echo "      \"designer\": \"\","
  echo "      \"foundry\": \"\","
  echo "      \"year\": \"\","
  echo "      \"description\": \"\","
  echo "      \"tags\": [],"
  echo "      \"added\": \"$TODAY\""
  echo "    }"

  ((COUNT++)) || true
done < <(find "$FONTS_DIR" -maxdepth 1 -type f \( -iname "*.ttf" -o -iname "*.otf" -o -iname "*.woff2" -o -iname "*.woff" \) -print0 | sort -z)

echo "  ],"
echo "  \"total\": $COUNT"
echo "}"

echo ""
echo "✅  Done! Found $COUNT fonts."
echo "📄  Run with output redirect: ./generate-manifest.sh > fonts.json"
