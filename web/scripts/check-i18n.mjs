// CI gate: the Sinhala dictionary may only override known keys, {placeholders}
// must match between languages, and every t('…') literal used in src/ must
// exist in the merged dictionary (generated + web-only extra keys).
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const read = (p) => JSON.parse(readFileSync(path.join(root, p), 'utf8'));

const en = { ...read('src/lib/i18n/generated/en.json'), ...read('src/lib/i18n/extra/en.json') };
const si = { ...read('src/lib/i18n/generated/si.json'), ...read('src/lib/i18n/extra/si.json') };
const problems = [];

for (const k of Object.keys(si)) if (!(k in en)) problems.push(`si has unknown key: ${k}`);
const vars = (s) => (String(s).match(/\{[a-zA-Z0-9_]+\}/g) || []).sort().join(',');
for (const k of Object.keys(si)) if (k in en && vars(en[k]) !== vars(si[k])) problems.push(`placeholder mismatch for ${k}: en "${vars(en[k])}" vs si "${vars(si[k])}"`);

// Web-only keys must be translated in both languages
const extraEn = read('src/lib/i18n/extra/en.json');
const extraSi = read('src/lib/i18n/extra/si.json');
for (const k of Object.keys(extraEn)) if (!(k in extraSi)) problems.push(`web-only key missing in si: ${k}`);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) { if (name !== 'generated') walk(p, out); }
    else if (/\.(tsx?|mts)$/.test(name) && !/\.d\.ts$/.test(name) && !/\.gen\.ts$/.test(name)) out.push(p);
  }
  return out;
}
const used = new Set();
for (const file of walk(path.join(root, 'src'))) {
  const text = readFileSync(file, 'utf8');
  for (const m of text.matchAll(/\bt\(\s*'([^']+)'/g)) used.add(m[1]);
  for (const m of text.matchAll(/\bt\(\s*"([^"]+)"/g)) used.add(m[1]);
  for (const m of text.matchAll(/\btk\(\s*'([^']+)'\)/g)) used.add(m[1]);
}
for (const k of used) if (!(k in en)) problems.push(`t('${k}') has no dictionary entry`);

if (problems.length) {
  console.error(`check:i18n failed with ${problems.length} problem(s):`);
  for (const p of problems) console.error('  - ' + p);
  process.exit(1);
}
console.log(`check:i18n ok — ${Object.keys(en).length} keys, ${Object.keys(si).length} Sinhala, ${used.size} used in src/`);
