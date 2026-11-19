// QR codes for printed membership cards. The generator is loaded only when a
// print is asked for, so it adds nothing to the first page load, and the code
// is drawn as one vector path so it prints sharply at any size.
//
// The payload is exactly what the member app's card shows — the society ID
// and nothing else — so the office USB scanner and the phone scanner read a
// printed card and a phone screen without knowing the difference.

export interface QrMatrix {
  size: number // modules per side, without the quiet zone
  dark: (row: number, col: number) => boolean
}

type Factory = (typeNumber: 0, level: 'L' | 'M' | 'Q' | 'H') => {
  addData(data: string): void
  make(): void
  getModuleCount(): number
  isDark(row: number, col: number): boolean
}

let factory: Promise<Factory> | null = null

function loadFactory(): Promise<Factory> {
  factory ??= import('qrcode-generator').then((mod) => {
    const candidate = (mod as unknown as { default?: unknown }).default ?? mod
    const qr = candidate as Factory & { stringToBytes?: unknown; stringToBytesFuncs?: Record<string, unknown> }
    // A society ID is nearly always plain ASCII, but nothing stops an office
    // from using Sinhala letters in one — encode as UTF-8 so it still scans.
    const utf8 = qr.stringToBytesFuncs?.['UTF-8']
    if (utf8) qr.stringToBytes = utf8
    return qr
  })
  return factory
}

// Medium error correction: a creased or slightly worn paper card still reads,
// without making the code so dense that a cheap printer blurs it.
export async function qrMatrix(text: string): Promise<QrMatrix> {
  const make = await loadFactory()
  const qr = make(0, 'M')
  qr.addData(text)
  qr.make()
  return { size: qr.getModuleCount(), dark: (r, c) => qr.isDark(r, c) }
}

// One <svg> with a single path. `quiet` is the white border in modules — the
// QR standard asks for four, and scanners genuinely fail without it when the
// code sits next to a printed border or cut line.
export function qrSvg(matrix: QrMatrix, { quiet = 4, sizeMm }: { quiet?: number; sizeMm: number }): string {
  const total = matrix.size + quiet * 2
  let d = ''
  for (let r = 0; r < matrix.size; r++) {
    let run = 0
    for (let c = 0; c <= matrix.size; c++) {
      const on = c < matrix.size && matrix.dark(r, c)
      if (on) {
        run++
      } else if (run > 0) {
        // Horizontal runs keep the path short: a card sheet holds ten codes
        d += `M${c - run + quiet} ${r + quiet}h${run}v1h-${run}z`
        run = 0
      }
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" width="${sizeMm}mm" height="${sizeMm}mm" shape-rendering="crispEdges" role="img"><rect width="${total}" height="${total}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`
}
