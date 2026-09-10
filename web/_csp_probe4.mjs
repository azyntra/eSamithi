import { chromium } from '@playwright/test';
const b = await chromium.launch({ channel: 'chrome' });
const page = await b.newPage();
const cdp = await page.context().newCDPSession(page);
const entries = [];
await cdp.send('Log.enable');
cdp.on('Log.entryAdded', ({ entry }) => entries.push(`[Log/${entry.source}/${entry.level}] ${entry.text}`));

await page.route('https://example.invalid/**', (r) => {
  const u = r.request().url();
  if (u.endsWith('/app.js')) {
    // exactly what zod does: try { Function("") } catch { }
    return r.fulfill({ status: 200, contentType: 'application/javascript',
      body: 'try{ Function(""); window.__jit=true }catch(e){ window.__jit=false; window.__err=e.name }' });
  }
  return r.fulfill({ status: 200, contentType: 'text/html',
    headers: { 'content-security-policy': "default-src 'self'; script-src 'self'" },
    body: '<!doctype html><script src="/app.js"></script>' });
});
await page.goto('https://example.invalid/c.html');
await page.waitForTimeout(1500);
console.log('=== CONTROL: external script, script-src self, Function("") ===');
console.log(entries.length ? entries.join('\n') : '(no browser log entries)');
console.log('jit result =', await page.evaluate(() => ({ jit: window.__jit, err: window.__err })));
await b.close();
