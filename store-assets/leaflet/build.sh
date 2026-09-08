#!/usr/bin/env bash
# Renders leaflet.html → A4 PDF, bleed PDF, per-page PNG proofs, and a base64-inlined standalone HTML.
set -euo pipefail
cd "$(dirname "$0")"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
SRC="file://$PWD/leaflet.html"
OUT="$PWD/out"; mkdir -p "$OUT"
COMMON=(--headless --disable-gpu --hide-scrollbars --virtual-time-budget=8000 --allow-file-access-from-files)
echo "→ overflow check"
TITLE=$("$CHROME" "${COMMON[@]}" --dump-dom "$SRC?debug=1" 2>/dev/null | grep -o '<title>[^<]*' | head -1)
echo "  $TITLE"
echo "→ A4 PDF";    "$CHROME" "${COMMON[@]}" --no-pdf-header-footer --print-to-pdf="$OUT/eSamithi-leaflet-A4.pdf" "$SRC" 2>/dev/null
echo "→ bleed PDF"; "$CHROME" "${COMMON[@]}" --no-pdf-header-footer --print-to-pdf="$OUT/eSamithi-leaflet-bleed.pdf" "$SRC?bleed=1" 2>/dev/null
for n in 1 2 3 4; do
  echo "→ proof p$n"; "$CHROME" "${COMMON[@]}" --window-size=794,1123 --force-device-scale-factor=2 --screenshot="$OUT/p$n.png" "$SRC?only=$n" 2>/dev/null
done
echo "→ standalone HTML (fonts + logo inlined)"
python3 - <<'PY'
import re,base64,pathlib
src=pathlib.Path('leaflet.html').read_text(encoding='utf-8')
def inline(m):
    rel=m.group(1); p=pathlib.Path(rel)
    mime='font/ttf' if p.suffix=='.ttf' else 'image/png'
    return "url('data:%s;base64,%s')"%(mime,base64.b64encode(p.read_bytes()).decode()) if m.group(0).startswith('url') else 'src="data:%s;base64,%s"'%(mime,base64.b64encode(p.read_bytes()).decode())
out=re.sub(r"url\('(\.\./\.\./[^']+)'\)",inline,src)
out=re.sub(r'src="(\.\./\.\./[^"]+)"',inline,out)
pathlib.Path('out/eSamithi-leaflet-standalone.html').write_text(out,encoding='utf-8')
print('  out/eSamithi-leaflet-standalone.html', round(len(out)/1e6,2),'MB')
PY
echo "→ verify"
echo "  pages: $(mdls -name kMDItemNumberOfPages -raw "$OUT/eSamithi-leaflet-A4.pdf" 2>/dev/null || echo '?')"
echo "  fonts: $(strings "$OUT/eSamithi-leaflet-A4.pdf" | grep -oE '(NotoSansSinhala|Inter|SinhalaSangam|Helvetica|ArialUnicode|Times)[A-Za-z-]*' | sort -u | tr '\n' ' ')"
ls -la "$OUT" | awk 'NR>1{print "  "$5, $9}'
