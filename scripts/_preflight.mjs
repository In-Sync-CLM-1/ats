// Pre-flight probe: verify every reworked beat against the LIVE app before rendering.
import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { loadEnv } from './lib/env.mjs';
import { BASE, candidateUrl, login } from './lib/app.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const env = loadEnv(new URL('../.env', import.meta.url));
const STATE = JSON.parse(readFileSync(join(here, 'seed-state.json'), 'utf8'));
const { candidateId } = STATE;

const results = [];
const check = (name, ok, extra = '') => { results.push({ name, ok, extra }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`); };

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 }, timezoneId: 'Asia/Kolkata', locale: 'en-IN' });
const page = await ctx.newPage();

// 1. Careers page: hero mandate on top
await page.goto(`${BASE}/careers/techcorp`, { waitUntil: 'networkidle' });
const cards = await page.locator('h3, [class*=title]').allTextContents().catch(() => []);
const heroVisible = await page.getByText('Senior Frontend Developer').first().isVisible().catch(() => false);
check('careers: hero job visible', heroVisible, cards.slice(0, 3).join(' | '));

// Login as admin
await login(page, env.ATS_ORG_ADMIN_EMAIL, env.ATS_ORG_ADMIN_PASSWORD);

// 2. Candidate profile: stage badge + move-stage control
await page.goto(candidateUrl(candidateId), { waitUntil: 'networkidle' });
await page.getByText('Priya Sharma').first().waitFor({ timeout: 15000 });
const stageBadge = await page.getByText('Interview', { exact: true }).first().isVisible().catch(() => false);
const stageSel = await page.getByRole('combobox', { name: /move stage/i }).first().isVisible().catch(() => false);
check('profile: stage badge Interview', stageBadge);
check('profile: Move stage control', stageSel);

// 3. Details tab now richer
const companyRow = await page.getByText(/current company/i).first().isVisible().catch(() => false);
const ctcRow = await page.getByText(/ctc:/i).first().isVisible().catch(() => false);
check('profile: current company row', companyRow);
check('profile: CTC row', ctcRow);

// 4. AI Insights: humanized labels
await page.getByRole('tab', { name: 'AI Insights' }).click().catch(() => {});
await page.waitForTimeout(2500);
const humanLabel = await page.getByText('Call Engagement').first().isVisible().catch(() => false);
const snake = await page.getByText('call_engagement').first().isVisible().catch(() => false);
check('ai score: humanized labels', humanLabel && !snake, `human=${humanLabel} snake=${snake}`);
const startBtn = await page.getByRole('button', { name: /start ai call/i }).first().isVisible().catch(() => false);
check('ai voice calls: Start AI Call button', startBtn);

// 5. Call History: AI Agent badge + AI Summary expand with transcript
await page.getByRole('tab', { name: 'Call History' }).click().catch(() => {});
await page.waitForTimeout(2000);
const aiAgentBadge = await page.getByText('AI Agent').first().isVisible().catch(() => false);
check('call history: AI Agent badge', aiAgentBadge);
const aiSummaryBtn = page.getByRole('button', { name: /ai summary/i }).first();
const hasBtn = await aiSummaryBtn.isVisible().catch(() => false);
check('call history: AI Summary button', hasBtn);
if (hasBtn) {
  await aiSummaryBtn.click().catch(() => {});
  await page.waitForTimeout(1000);
  const transcript = await page.getByText('Transcript', { exact: true }).first().isVisible().catch(() => false);
  const analysis = await page.getByText('AI Analysis').first().isVisible().catch(() => false);
  const quality = await page.getByText(/quality 82/i).first().isVisible().catch(() => false);
  check('call history: transcript panel', transcript);
  check('call history: analysis panel', analysis);
  check('call history: quality 82 badge', quality);
}

// 6. Candidates list: Filters search narrows to Priya; enrichment shows
await page.goto(`${BASE}/candidates`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
await page.getByRole('button', { name: /^filters$/i }).first().click().catch(() => {});
await page.waitForTimeout(600);
await page.getByPlaceholder(/search by name, phone/i).first().fill('Priya').catch(() => {});
await page.waitForTimeout(2500);
const rows = await page.locator('tbody tr').count().catch(() => -1);
const priyaRow = await page.getByText('Priya Sharma').first().isVisible().catch(() => false);
check('candidates: search filters list', priyaRow && rows > 0 && rows <= 3, `rows=${rows}`);
const unassigned = await page.getByText('Unassigned').count().catch(() => -1);
check('candidates: no Unassigned in filtered view', unassigned === 0, `unassigned=${unassigned}`);

// 7. Email dialog: org sender, no {{name}} placeholder
await page.goto(candidateUrl(candidateId), { waitUntil: 'networkidle' });
await page.getByText('Priya Sharma').first().waitFor({ timeout: 15000 });
await page.getByRole('button', { name: /email/i }).first().click().catch(() => {});
await page.waitForTimeout(1500);
const fromVal = await page.locator('#fromName').inputValue().catch(() => '');
const bodyPh = await page.locator('#body').getAttribute('placeholder').catch(() => '');
check('email dialog: From = TechCorp Solutions', fromVal === 'TechCorp Solutions', `from="${fromVal}"`);
check('email dialog: placeholder uses real name', bodyPh?.includes('Hi Priya'), bodyPh?.slice(0, 30));
await page.keyboard.press('Escape');

// 8. Call dialog: company populated
await page.getByRole('button', { name: /^call$/i }).first().click().catch(() => {});
await page.waitForTimeout(1200);
const na = await page.getByText('N/A').count().catch(() => -1);
const zen = await page.getByText('Zenlabs Software').first().isVisible().catch(() => false);
check('call dialog: company populated', zen && na === 0, `zenlabs=${zen} n/a-count=${na}`);
await page.keyboard.press('Escape');

// 9. My Desk under Aarav: Priya flagged Call today
const ctx2 = await browser.newContext({ viewport: { width: 1366, height: 768 }, timezoneId: 'Asia/Kolkata', locale: 'en-IN' });
const p2 = await ctx2.newPage();
await login(p2, env.ATS_RECRUITER_EMAIL, env.ATS_RECRUITER_PASSWORD);
await p2.goto(`${BASE}/my-desk`, { waitUntil: 'networkidle' });
await p2.waitForTimeout(2500);
const priyaDesk = await p2.getByText('Priya Sharma').first().isVisible().catch(() => false);
const callToday = await p2.getByText(/call today/i).count().catch(() => 0);
check('my desk (Aarav): Priya visible', priyaDesk);
check('my desk (Aarav): call-today flags', callToday > 0, `count=${callToday}`);

// 10. Recruiter performance: non-zero KPIs current month
await p2.goto(`${BASE}/recruiter-performance`, { waitUntil: 'networkidle' });
await p2.waitForTimeout(3000);
const bodyText = await p2.locator('body').innerText().catch(() => '');
const zeroHired = /Candidates Hired\s*\n?\s*0\b/.test(bodyText);
const hundredPct = /100\.0% connection/.test(bodyText);
check('performance: hired not zero', !zeroHired);
check('performance: connection not 100%', !hundredPct);

await browser.close();
const fails = results.filter(r => !r.ok);
console.log(`\n${results.length - fails.length}/${results.length} passed`);
process.exit(fails.length ? 1 : 0);
