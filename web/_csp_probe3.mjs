import { chromium } from '@playwright/test';
const b = await chromium.launch({ channel: 'chrome' });

async function run(label, gotoFn) {
  const page = await b.newPage();
  const cdp = await page.context().newCDPSession(page);
  const entries = [];
  await cdp.send('Log.enable');
  await cdp.send('Runtime.enable');
  cdp.on('Log.entryAdded', ({ entry }) => entries.push(`[Log/${entry.source}/${entry.level}] ${entry.text}`));
  cdp.on('Runtime.consoleAPICalled', (e) => entries.push(`[RuntimeAPI/${e.type}]`));
  await gotoFn(page);
  await page.waitForTimeout(2000);
  console.log(`\n=== ${label} ===`);
  console.log(entries.length ? entries.join('\n') : '(no browser log entries)');
  await page.close();
}

// CONTROL: a page with the same CSP that calls eval -> must produce the console error
const control = `<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'"><script>try{Function("")}catch(e){}<\/script>`;
await run('CONTROL data: page, script-src self, Function("")', async (p) => {
  await p.route('https://example.invalid/**', (r) =>
    r.fulfill({ status: 200, contentType: 'text/html', body: control }));
  await p.goto('https://example.invalid/c.html');
});

await run('LIVE https://app.esamithi.com/', (p) =>
  p.goto('https://app.esamithi.com/', { waitUntil: 'networkidle' }));

await b.close();
