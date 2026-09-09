#!/usr/bin/env bash
# TTF (mobile/assets/fonts) → woff2 (src/assets/fonts), unsubsetted so every Sinhala conjunct survives.
# Needs: python3 -m venv .fonts && .fonts/bin/pip install fonttools brotli
set -euo pipefail
cd "$(dirname "$0")/.."
PY="${FONTS_PY:-.fonts/bin/pyftsubset}"
if [ ! -x "$PY" ]; then python3 -m venv .fonts && .fonts/bin/pip -q install fonttools brotli; fi
mkdir -p src/assets/fonts
for f in Inter-Regular Inter-SemiBold Inter-Bold NotoSansSinhala-Regular NotoSansSinhala-SemiBold NotoSansSinhala-Bold; do
  "$PY" "../mobile/assets/fonts/$f.ttf" --unicodes='*' --layout-features='*' --flavor=woff2 --output-file="src/assets/fonts/$f.woff2"
  echo "  ✓ $f.woff2 ($(wc -c < "src/assets/fonts/$f.woff2") bytes)"
done
