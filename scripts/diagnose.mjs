// Diagnostic: screenshot what Siddharth Roy sees at each key ATS URL.
// Run: node scripts/diagnose.mjs
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { loadEnv } from './lib/env.mjs';
import { login, BASE, candidateUrl, mandateUrl, applyUrl, joinUrl } from './lib/app.mjs';
import { readFileSync } from 'fs';

const env = loadEnv(new URL('../.env', import.meta.url));
const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, 'recordings', 'diag');
mkdirSync(outDir, { recursive: true });

const STATE = JSON.parse(readFileSync(join(here, 'seed-state.json'), 'utf8'));
const { candidateId, referralCode, formSlug } = STATE;

const VP = { width: 1366, height: 768 };

const browser = await chromium.launch({ headless: true });

// ── Login as Siddharth Roy ──────────────────────────────────────────────────
console.log(`Logging in as ${env.ATS_ORG_ADMIN_EMAIL}...`);
const ctx = await browser.newContext({ viewport: VP, timezoneId: 'Asia/Kolkata', locale: 'en-IN' });
const page = await ctx.newPage();

let loginOk = false;
try {
  await login(page, env.ATS_ORG_ADMIN_EMAIL, env.ATS_ORG_ADMIN_PASSWORD);
  console.log('  login OK — current URL:', page.url());
  loginOk = true;
} catch (e) {
  console.error('  LOGIN FAILED:', e.message);
  await page.screenshot({ path: join(outDir, '00-login-fail.png'), fullPage: true });
}

if (loginOk) {
  const shot = async (name, url, waitFor) => {
    try {
      await page.goto(url, { waitUntil: 'networkidle' });
      if (waitFor) await page.waitForTimeout(waitFor);
      await page.screenshot({ path: join(outDir, `${name}.png`), fullPage: false });
      console.log(`  [${name}] ${page.url()}`);
    } catch (e) {
      console.log(`  [${name}] ERROR: ${e.message.split('\n')[0]}`);
      await page.screenshot({ path: join(outDir, `${name}-err.png`), fullPage: false });
    }
  };

  await shot('01-dashboard', `${BASE}/dashboard`, 3000);
  await shot('02-candidates', `${BASE}/candidates`, 2000);
  await shot('03-candidate-view', candidateUrl(candidateId), 3000);
  // Navigate to candidate page then click AI Insights tab
  try {
    await page.goto(candidateUrl(candidateId), { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await page.getByRole('tab', { name: /ai insights/i }).click();
    await page.waitForTimeout(3000);
    await page.screenshot({ path: join(outDir, '03b-candidate-ai-tab.png'), fullPage: false });
    console.log('  [03b-candidate-ai-tab] clicked AI Insights tab');
  } catch (e) {
    console.log('  [03b-candidate-ai-tab] ERROR:', e.message.split('\n')[0]);
    await page.screenshot({ path: join(outDir, '03b-candidate-ai-tab-err.png'), fullPage: false });
  }
  await shot('04-mandates', `${BASE}/mandates`, 2000);
  await shot('04b-mandate-view', mandateUrl(STATE.mandateId), 2000);
  await shot('05-hr-onboarding', `${BASE}/hr-onboarding`, 2000);
  await shot('05b-recruiter-perf', `${BASE}/recruiter-performance`, 2000);
  await shot('05c-calling-dashboard', `${BASE}/calling-dashboard`, 2000);
}

// ── Guest: referral + join pages ────────────────────────────────────────────
const gCtx = await browser.newContext({ viewport: VP });
const gPage = await gCtx.newPage();

const gshot = async (name, url) => {
  try {
    await gPage.goto(url, { waitUntil: 'networkidle' });
    await gPage.waitForTimeout(2000);
    await gPage.screenshot({ path: join(outDir, `${name}.png`), fullPage: false });
    console.log(`  [${name}] ${gPage.url()}`);
  } catch (e) {
    console.log(`  [${name}] ERROR: ${e.message.split('\n')[0]}`);
    await gPage.screenshot({ path: join(outDir, `${name}-err.png`), fullPage: false }).catch(() => {});
  }
};

await gshot('06-apply', applyUrl(referralCode));
await gshot('07-join', joinUrl(formSlug));

await browser.close();
console.log(`\nScreenshots written to: ${outDir}`);
