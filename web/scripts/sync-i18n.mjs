// Generates the web dictionaries from the desktop's i18n source of truth.
//   node --experimental-strip-types scripts/sync-i18n.mjs
// src/renderer/src/i18n/{en,si}.ts → src/lib/i18n/generated/{en,si}.json
// The desktop stays the source until it is frozen (requirements §6.2); after
// that the generated JSON becomes the source and this script is retired.
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.resolve(here, '../../src/renderer/src/i18n');
const outDir = path.resolve(here, '../src/lib/i18n/generated');
mkdirSync(outDir, { recursive: true });

const { en } = await import(pathToFileURL(path.join(srcDir, 'en.ts')).href);
const { si } = await import(pathToFileURL(path.join(srcDir, 'si.ts')).href);

function write(name, dict) {
  const sorted = Object.fromEntries(Object.keys(dict).sort().map((k) => [k, dict[k]]));
  const file = path.join(outDir, `${name}.json`);
  const next = JSON.stringify(sorted, null, 2) + '\n';
  let prev = null;
  try { prev = readFileSync(file, 'utf8'); } catch { /* first run */ }
  if (prev !== next) writeFileSync(file, next);
  return { count: Object.keys(sorted).length, changed: prev !== next };
}

const e = write('en', en);
const s = write('si', si);
console.log(`i18n synced: en ${e.count} keys${e.changed ? ' (updated)' : ''}, si ${s.count} keys${s.changed ? ' (updated)' : ''}`);
