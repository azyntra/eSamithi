# eSamithi village leaflet (Sinhala) — 4 pages, 2 × A4 double-sided

Source: `leaflet.html` (fonts + logo referenced from `../../mobile/assets/`).
Build:  `./build.sh` → `out/`
- `eSamithi-leaflet-A4.pdf` — plain A4, for office/home printers
- `eSamithi-leaflet-bleed.pdf` — 216 × 303 mm (3 mm bleed) for a print shop
- `p1.png … p4.png` — proofs of each page
- `eSamithi-leaflet-standalone.html` — single self-contained file (fonts inlined)

## Printing at the office / at home
Print `eSamithi-leaflet-A4.pdf`, **two-sided, flip on long edge**, 100% scale (no "fit to page").
Sheet 1 = pages 1 + 2, sheet 2 = pages 3 + 4. Any 120–160 gsm paper.

## At a print shop
Give them `eSamithi-leaflet-bleed.pdf`. Trim size 210 × 297 mm, 3 mm bleed all round,
no crop marks included (impose from the centred trim box). 2 sheets, double-sided,
long-edge flip, no staple. 170–200 gsm silk or matt. Ask for a digital proof and compare
against `out/p1.png`–`p4.png`.

## Editing
- Contact number and society reference are plain text in `leaflet.html` (search `+94`, `140`).
- All numbers inside the phone/PC mockups are invented demo values — never client data.
- After any edit run `./build.sh`; the build prints `eSamithi leaflet OK` when nothing
  overflows a page, and lists the embedded fonts (must be only NotoSansSinhala + Inter).
