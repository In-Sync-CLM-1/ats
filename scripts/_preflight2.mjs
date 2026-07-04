// Pre-flight for the v4 changes: merged AI details, list score column, dialer, findings.
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
const check = (name, ok, extra = '') => console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`);

const browser = await chromium.launch({ headless: true });
const p = await (await browser.newContext({ viewport: { width: 1920, height: 1080 } })).newPage();
await login(p, env.ATS_RECRUITER_EMAIL, env.ATS_RECRUITER_PASSWORD);

// 1. Profile: score card inline in Details, no AI Insights tab
await p.goto(candidateUrl(candidateId), { waitUntil: 'networkidle' });
await p.getByText('Priya Sharma').first().waitFor({ timeout: 15000 });
await p.waitForTimeout(2500);
const aiTab = await p.getByRole('tab', { name: 'AI Insights' }).count();
const scoreInline = await p.getByText('AI Candidate Score').first().isVisible().catch(() => false);
const voiceInline = await p.getByText('AI Voice Calls').first().isVisible().catch(() => false);
check('profile: AI Insights tab removed', aiTab === 0);
check('profile: score card inline in Details', scoreInline);
check('profile: AI Voice Calls inline in Details', voiceInline);

// 2. Dialer console (stubbed)
await p.route('**/functions/v1/ai-screen-candidate', async (route) => {
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, OPTIONS' };
  if (route.request().method() === 'OPTIONS') { await route.fulfill({ status: 204, headers: cors }); return; }
  await new Promise((r) => setTimeout(r, 2500));
  await route.fulfill({ status: 200, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify({ execution_id: 'exec_test', call_log_id: 'x' }) });
});
await p.getByText(/ai voice calls/i).first().scrollIntoViewIfNeeded().catch(() => {});
await p.getByRole('button', { name: /start ai call/i }).first().click();
await p.waitForTimeout(1000);
const dialer = await p.getByText(/dialing priya/i).first().isVisible().catch(() => false);
const number = await p.getByText(/\+91 9876543210/).first().isVisible().catch(() => false);
await p.screenshot({ path: join(here, '..', '..', 'AppData/Local/Temp/claude/C--Users-Admin-ats/25b20844-a873-4f38-8a2b-cb8ac7d2c28c/scratchpad/v2', 'dialer-probe.png').replace(/\\/g, '/'), clip: undefined }).catch(() => {});
check('dialer: "Dialing Priya" console visible', dialer);
check('dialer: phone number shown', number);
await p.getByText(/ai call initiated/i).first().waitFor({ timeout: 8000 }).catch(() => {});
const initiated = await p.getByText(/on the line/i).first().isVisible().catch(() => false);
check('dialer: initiated card', initiated);

// 3. Candidates list: AI Score column
await p.goto(`${BASE}/candidates`, { waitUntil: 'networkidle' });
await p.waitForTimeout(3000);
const scoreHead = await p.getByText('AI Score', { exact: true }).first().isVisible().catch(() => false);
const chips = await p.locator('tbody').getByText(/promising|strong|hire|weak/i).count().catch(() => 0);
check('list: AI Score column', scoreHead);
check('list: score chips on rows', chips > 3, `chips=${chips}`);

// 4. Onboarding findings checklist (admin)
const ctx2 = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
const p2 = await ctx2.newPage();
await login(p2, env.ATS_ORG_ADMIN_EMAIL, env.ATS_ORG_ADMIN_PASSWORD);
await p2.goto(`${BASE}/hr-onboarding`, { waitUntil: 'networkidle' });
await p2.waitForTimeout(2000);
await p2.getByRole('button', { name: /view details/i }).first().click().catch(() => {});
await p2.waitForTimeout(2000);
const reliving = await p2.getByText(/resignation & relieving/i).first().isVisible().catch(() => false);
const slips = await p2.getByText(/salary slips/i).first().isVisible().catch(() => false);
const credit = await p2.getByText(/bank credit match/i).first().isVisible().catch(() => false);
const approveBadge = await p2.getByText(/^Approve$/).first().isVisible().catch(() => false);
check('onboarding: relieving letter finding', reliving);
check('onboarding: salary slips finding', slips);
check('onboarding: bank credit match finding', credit);
check('onboarding: Approve recommendation badge', approveBadge);

await browser.close();
