// Capture crisp module stills for the Remotion promo (device-frame hero shots).
// Feature-led shoot: mandates/SLA, pipeline, bulk import, KYC onboarding,
// calling, recruiter analytics — the website product page's own feature spine.
import { chromium } from 'playwright';
import { BASE, login } from './lib/app.mjs';
import { loadEnv } from './lib/env.mjs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync } from 'fs';

const env = loadEnv(new URL('../.env', import.meta.url));
const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, 'assets', 'promo');
mkdirSync(out, { recursive: true });
const VP = { width: 1600, height: 1000 };

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: VP, deviceScaleFactor: 2 });
const page = await ctx.newPage();
await login(page, env.ATS_ORG_ADMIN_EMAIL, env.ATS_ORG_ADMIN_PASSWORD);

const shot = async (name, url, waitText, extra) => {
  await page.goto(`${BASE}${url}`, { waitUntil: 'networkidle' });
  if (waitText) await page.getByText(waitText).first().waitFor({ timeout: 25000 }).catch(() => {});
  if (extra) await extra(page).catch(() => {});
  await page.mouse.move(2, 2);
  await page.waitForTimeout(1400);
  await page.screenshot({ path: join(out, `${name}.png`) });
  console.log('  shot', name);
};

await shot('dashboard', '/dashboard', /Dashboard|Candidates/);
await shot('mandates', '/mandates', /Mandate/);
await shot('candidates', '/candidates', /Candidates/);
await shot('import', '/candidates', /Candidates/, async (p) => {
  await p.getByRole('button', { name: /bulk upload/i }).first().click();
  await p.getByText(/Bulk Import Candidates/i).first().waitFor({ timeout: 10000 });
  await p.waitForTimeout(600);
});
await shot('verify', '/hr-onboarding', /Onboarding/, async (p) => {
  // open the first submission's detail (eye action) so Aadhaar/PAN rows show
  await p.locator('table tbody tr').last().locator('button').first().click({ timeout: 8000 });
  await p.waitForTimeout(1000);
});
await shot('calling', '/calling-dashboard', /Calling|Call/);
await shot('performance', '/recruiter-performance', /Performance|Recruiter/);
await ctx.close();
await browser.close();
console.log('done');
