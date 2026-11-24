const fs = require('fs');
const crypto = require('crypto');
const sharp = require('sharp');
const { PDFDocument } = require('pdf-lib');

// Image, PDF and audio handling for meeting minutes
// (docs/MEETING-MINUTES-REQUIREMENTS.md §6.3–§6.5). No ffmpeg, no native
// tools beyond sharp's prebuilt libvips.

const MAX_SIDE = 2400;
const THUMB_SIDE = 320;

function fail(statusCode, code, message) {
  return Object.assign(new Error(message), { statusCode, code });
}

// A photographed page → upright, metadata-free JPEG (EXIF, including any GPS
// position, is dropped) plus a thumbnail. Handwriting stays readable: the
// phone already sends 2000 px; anything larger is capped at 2400 px.
async function processPage(input, { rotate = 0 } = {}) {
  let img;
  try {
    img = sharp(input, { failOn: 'error' }).rotate(); // apply EXIF orientation
    if (rotate) img = sharp(await img.toBuffer()).rotate(rotate);
    const { data, info } = await img
      .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 80, mozjpeg: true })
      .toBuffer({ resolveWithObject: true });
    const thumb = await sharp(data)
      .resize({ width: THUMB_SIDE, height: THUMB_SIDE, fit: 'inside' })
      .jpeg({ quality: 72, mozjpeg: true })
      .toBuffer();
    return { data, thumb, width: info.width, height: info.height };
  } catch (err) {
    if (err.statusCode) throw err;
    throw fail(400, 'UNSUPPORTED_TYPE', 'That file is not a photo eSamithi can read. Use a JPEG or PNG photo.');
  }
}

// Same identity for the same pages in the same order: the draft PDF is
// rebuilt only when this changes. Rotation produces a new file, so the file
// names alone describe the result.
function pagesHash(files) {
  return crypto.createHash('sha256').update(JSON.stringify(files)).digest('hex');
}

const A4 = [595.28, 841.89];
const MARGIN = 18;

// One PDF from page JPEGs in order, each fitted to A4 in the orientation of
// the photo. No re-compression: the JPEGs are embedded as they are.
async function buildPdf(pagePaths, { title, author, subject } = {}) {
  const doc = await PDFDocument.create();
  doc.setTitle(title || 'Meeting minutes');
  if (author) doc.setAuthor(author);
  if (subject) doc.setSubject(subject);
  doc.setProducer('eSamithi');
  doc.setCreator('eSamithi');
  for (const p of pagePaths) {
    // A fresh Uint8Array: pdf-lib reads the underlying ArrayBuffer from offset
    // 0, and a small file from readFileSync sits at an offset in Node's pool
    const jpg = await doc.embedJpg(new Uint8Array(fs.readFileSync(p)));
    const landscape = jpg.width > jpg.height;
    const [pw, ph] = landscape ? [A4[1], A4[0]] : A4;
    const scale = Math.min((pw - 2 * MARGIN) / jpg.width, (ph - 2 * MARGIN) / jpg.height);
    const w = jpg.width * scale;
    const h = jpg.height * scale;
    const page = doc.addPage([pw, ph]);
    page.drawImage(jpg, { x: (pw - w) / 2, y: (ph - h) / 2, width: w, height: h });
  }
  return Buffer.from(await doc.save());
}

// What an uploaded recording really is, from its first bytes (never trust a
// client's content type). Every format here plays on Android and in
// Chrome/Edge without transcoding.
function sniffAudio(head) {
  if (!head || head.length < 12) return null;
  const ascii = (a, b) => head.subarray(a, b).toString('latin1');
  if (ascii(4, 8) === 'ftyp') return { ext: '.m4a', mime: 'audio/mp4' };
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WAVE') return { ext: '.wav', mime: 'audio/wav' };
  if (ascii(0, 4) === 'OggS') return { ext: '.ogg', mime: 'audio/ogg' };
  if (ascii(0, 3) === 'ID3') return { ext: '.mp3', mime: 'audio/mpeg' };
  if (head[0] === 0xff && (head[1] & 0xf6) === 0xf0) return { ext: '.aac', mime: 'audio/aac' }; // ADTS
  if (head[0] === 0xff && (head[1] & 0xe0) === 0xe0) return { ext: '.mp3', mime: 'audio/mpeg' }; // MPEG frame
  return null;
}

module.exports = { processPage, pagesHash, buildPdf, sniffAudio, MAX_SIDE, THUMB_SIDE };
