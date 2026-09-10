import { chromium } from '@playwright/test';
const b = await chromium.launch({ channel: 'chrome' });
const page = await b.newPage();
const cdp = await page.context().newCDPSession(page);
const log = [], exc = [], issues = [], cons = [];
await cdp.send('Log.enable');
await cdp.send('Runtime.enable');
await cdp.send('Audits.enable');
cdp.on('Log.entryAdded', ({ entry }) => log.push(`[${entry.source}/${entry.level}] ${entry.text}`));
cdp.on('Runtime.exceptionThrown', (e) => exc.push(e.exceptionDetails.text + ' ' + (e.exceptionDetails.exception?.description||'')));
cdp.on('Audits.issueAdded', ({ issue }) => issues.push(issue.code + ' :: ' + JSON.stringify(issue.details).slice(0,220)));
page.on('console', (m) => cons.push(`${m.type()}: ${m.text()}`));

await page.goto('https://app.esamithi.com/', { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);

console.log('=== LIVE app.esamithi.com — what DevTools would show ===');
console.log('CONSOLE messages (page.on console) :', cons.length ? cons : '(none)');
console.log('Log.entryAdded (browser console)   :', log.length ? log : '(none)');
console.log('Runtime.exceptionThrown (uncaught) :', exc.length ? exc : '(none)');
console.log('Audits issues (Issues panel)       :', issues.length ? issues : '(none)');
await b.close();
