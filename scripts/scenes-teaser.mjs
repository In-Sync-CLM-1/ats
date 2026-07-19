// In-Sync ATS — 55-second prospect teaser.
// Hook → three flashes of the magic (AI profile, AI dialer, the save) → number + CTA.
// In-Sync-branded cards (prospects don't know TechCorp); footage credited as a
// client workspace. Render with:
//   CUT_NAME=teaser SCENES_FILE=scenes-teaser.mjs OUT_FILE=C:\Users\Admin\Downloads\ats-teaser.mp4 \
//   SKIP_SEED=1 FRESH_VIDEO=1 node scripts/render-continuous.mjs
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { BASE, candidateUrl } from './lib/app.mjs';
import { ACCT } from './lib/scene.mjs';
import { loadEnv } from './lib/env.mjs';
import { zoomTo, zoomReset } from './lib/annotate.mjs';
import { clickLocator } from './lib/cursor.mjs';

const here = dirname(fileURLToPath(import.meta.url));
let STATE = {};
try { STATE = JSON.parse(readFileSync(join(here, 'seed-state.json'), 'utf8')); }
catch { console.warn('seed-state.json not found — run seed-ats.mjs first'); }
const { candidateId, orgId, recruiterIds } = STATE;
const AARAV_ID = recruiterIds?.find((r) => r.name === 'Aarav Mehta')?.id;
const INSYNC_LOGO = 'data:image/png;base64,' +
  readFileSync(join(here, '..', 'src', 'assets', 'ats-logo.png')).toString('base64');

// Ensure Priya's offer-confirmation call exists for the "save" flash.
const env = loadEnv(new URL('../.env', import.meta.url));
const SB_URL = 'https://htdwkhtfdifwajdkkpul.supabase.co';
const SB_KEY = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY;
async function ensureConfirmationCall() {
  const H = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json' };
  const execId = `demo-confirm-${candidateId.slice(0, 8)}`;
  const ex = await fetch(`${SB_URL}/rest/v1/call_logs?bolna_execution_id=eq.${execId}&select=id`, { headers: H }).then((r) => r.json());
  if (ex?.length) return;
  const joinStr = new Date(Date.now() + 10 * 86400000).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const now = new Date();
  await fetch(`${SB_URL}/rest/v1/call_logs`, {
    method: 'POST', headers: { ...H, Prefer: 'return=minimal' },
    body: JSON.stringify({
      demandcom_id: candidateId, org_id: orgId, from_number: 'bolna-ai', to_number: '9876543210',
      status: 'completed', direction: 'outbound-api', call_method: 'bolna',
      bolna_execution_id: execId, conversation_duration: 190,
      disposition: 'Connected', subdisposition: 'Joining Confirmed',
      transcript: `Agent: Hi Priya, I'm calling about the offer for the Senior Frontend Developer role. Did you get a chance to review it?
Priya: Yes — sorry I went quiet, my current company made a counter-offer.
Agent: Completely understandable. Where did you land?
Priya: I'm declining the counter. I'm accepting — joining on ${joinStr}.
Agent: Wonderful. You'll receive the onboarding link today. Congratulations, Priya.`,
      analysis_json: {
        summary: `Priya confirmed she is JOINING on ${joinStr}. Counter-offer from current employer declined; relieving letter in process. Ready for onboarding.`,
        next_step: 'Send onboarding link', interest_level: 'high', joining_date: joinStr, notice_period_days: 0,
      },
      analysis_quality_score: 88,
      start_time: now.toISOString(), end_time: new Date(now.getTime() + 190000).toISOString(),
      initiated_by: AARAV_ID, created_at: now.toISOString(),
    }),
  });
}

const SLIDE_HEAD = `<style>
  *{margin:0;padding:0;box-sizing:border-box}html,body{height:100%}
  body{font-family:'Segoe UI',Arial,sans-serif;color:#e5e9f5;overflow:hidden;
    background:radial-gradient(900px 500px at 15% -10%,rgba(59,130,246,.28),transparent 60%),
               radial-gradient(800px 500px at 95% 115%,rgba(37,99,235,.30),transparent 55%),
               linear-gradient(135deg,#0a0f1e 0%,#0d1830 55%,#101f42 100%)}
  .wrap{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:56px}
  .logocard{background:#fff;border-radius:22px;padding:16px 26px;margin-bottom:38px;box-shadow:0 14px 40px rgba(0,0,0,.35);
    opacity:0;animation:fade .7s ease .1s forwards}
  .logocard img{height:74px;width:auto;display:block}
  .stat{color:#60a5fa;font-weight:800;font-size:25px;letter-spacing:.02em;margin-bottom:20px;opacity:0;animation:fade .7s ease .3s forwards}
  h1{font-size:72px;line-height:1.06;font-weight:800;letter-spacing:-.02em;opacity:0;transform:translateY(10px);animation:rise .8s cubic-bezier(.2,.7,.2,1) .45s forwards}
  h1 .g{color:#60a5fa}
  .tag{margin-top:26px;font-size:27px;color:#9fb0d0;opacity:0;animation:fade .7s ease .7s forwards}
  .cta{margin-top:38px;display:inline-block;background:linear-gradient(135deg,#3b82f6,#2563eb);color:#fff;font-weight:700;font-size:28px;
    padding:20px 44px;border-radius:999px;box-shadow:0 12px 30px rgba(37,99,235,.4);opacity:0;animation:rise .7s ease .8s forwards}
  .num{margin-top:32px;display:flex;gap:18px;justify-content:center;opacity:0;animation:fade .7s ease .95s forwards}
  .num .chip{background:rgba(96,165,250,.12);border:1px solid rgba(96,165,250,.35);border-radius:14px;padding:13px 24px;font-size:20px;color:#bcd3f7}
  .num .chip b{color:#fff;font-size:24px}
  .foot{margin-top:30px;color:#8296b8;font-size:18px;letter-spacing:.02em;opacity:0;animation:fade .7s ease 1.1s forwards}
  @keyframes fade{to{opacity:1}}@keyframes rise{to{opacity:1;transform:translateY(0)}}
</style>`;

const HOOK_HTML = `<!doctype html><html><head><meta charset="utf-8">${SLIDE_HEAD}</head><body>
  <div class="wrap">
    <div class="logocard"><img src="${INSYNC_LOGO}"/></div>
    <div class="stat">In-Sync ATS · Applicant Tracking</div>
    <h1>Hires aren't lost at sourcing.<br>They're lost <span class="g">between shortlisted and joined.</span></h1>
    <div class="tag">In-Sync ATS closes that gap — the grind runs itself, your recruiters close hires.</div>
    <div class="foot">Product footage: TechCorp Solutions — a client workspace</div>
  </div></body></html>`;

const CLOSE_HTML = `<!doctype html><html><head><meta charset="utf-8">${SLIDE_HEAD}</head><body>
  <div class="wrap">
    <div class="logocard"><img src="${INSYNC_LOGO}"/></div>
    <h1 style="font-size:60px">Recruiters close hires.<br>The <span class="g">grind runs itself.</span></h1>
    <div class="num">
      <div class="chip"><b>1</b> Candidates arrive AI-scored — a ranked list to judge</div>
      <div class="chip"><b>2</b> The chasing calls itself · ₹3/min — not an afternoon</div>
      <div class="chip"><b>3</b> Every call in writing — quiet candidates caught</div>
    </div>
    <div class="num" style="animation-delay:1.05s"><div class="chip"><b>₹799</b> per recruiter / month · live in a day</div></div>
    <div class="cta">Book your 30-minute demo →</div>
    <div class="foot">In-Sync ATS · part of the In-Sync suite by Prosync</div>
  </div></body></html>`;

export const SCENES = [

  {
    name: 't0-hook', account: ACCT.guest,
    narration: "Hires aren't lost at sourcing. They're lost between shortlisted and joined. In-Sync ATS closes that gap — the grind runs itself, your recruiters close hires.",
    beats: async ({ page, D, ready }) => {
      await page.setContent(HOOK_HTML, { waitUntil: 'load' });
      const waitUntil = await ready(300);
      await waitUntil(D);
    },
  },

  {
    name: 't1-ai', account: ACCT.recruiter,
    narration: "One — candidates arrive scored. Résumés file themselves, and every profile comes ranked by A.I. — a list your recruiter judges.",
    beats: async ({ page, at, D, ready }) => {
      await page.goto(candidateUrl(candidateId), { waitUntil: 'networkidle' });
      await page.getByText('Priya Sharma').first().waitFor({ timeout: 20000 });
      await page.getByText(/promising/i).first().waitFor({ timeout: 8000 }).catch(() => {});
      const waitUntil = await ready(600);
      await waitUntil(at('file themselves', 3, -0.3));
      await zoomTo(page, page.getByText(/ai candidate score/i).first(), 1.14, 800).catch(() => {});
      await waitUntil(at('scored', D - 1.5, -0.3));
      await zoomReset(page);
      await waitUntil(D);
    },
  },

  {
    name: 't2-call', account: ACCT.recruiter,
    narration: "Two — the chasing calls itself. Reminders, confirmations, follow-ups: an A.I. voice agent makes them for you. Watch it dial — your recruiters keep selling the role.",
    beats: async ({ page, at, D, ready }) => {
      await page.route('**/functions/v1/ai-screen-candidate', async (route) => {
        const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, OPTIONS' };
        if (route.request().method() === 'OPTIONS') { await route.fulfill({ status: 204, headers: cors }); return; }
        await new Promise((r) => setTimeout(r, 6000)); // dialer console holds to scene end
        await route.fulfill({ status: 200, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify({ execution_id: 'exec_8f3a29d1c740', call_log_id: 'cl_9d1f77' }) });
      });
      await page.goto(candidateUrl(candidateId), { waitUntil: 'networkidle' });
      await page.getByText('Priya Sharma').first().waitFor({ timeout: 20000 });
      await page.getByText(/ai voice calls/i).first().scrollIntoViewIfNeeded().catch(() => {});
      await page.waitForTimeout(400);
      const waitUntil = await ready(500);
      await waitUntil(at('makes them for you', 5, -0.5));
      const startBtn = page.getByRole('button', { name: /start ai call/i }).first();
      await clickLocator(page, startBtn, { dur: 500 }).catch(() => startBtn.click().catch(() => {}));
      await page.getByText(/dialing priya/i).first().waitFor({ timeout: 5000 }).catch(() => {});
      await zoomTo(page, page.getByText(/dialing priya/i).first(), 1.2, 700).catch(() => {});
      await waitUntil(at('keep selling', D - 1.2));
      await zoomReset(page);
      await waitUntil(D);
    },
  },

  {
    name: 't3-proof', account: ACCT.recruiter,
    narration: "Three — nothing stays unwritten. Every call comes back transcribed and summarized. And when a candidate goes quiet before joining, the system catches it — and brings back the save in writing.",
    beats: async ({ page, at, D, ready }) => {
      await ensureConfirmationCall();
      // Load + open BEFORE ready(): the teaser cuts straight to the proof.
      await page.goto(candidateUrl(candidateId), { waitUntil: 'networkidle' });
      await page.getByText('Priya Sharma').first().waitFor({ timeout: 20000 });
      const callTab = page.getByRole('tab', { name: 'Call History' });
      await callTab.waitFor({ timeout: 8000 }).catch(() => {});
      await callTab.click().catch(() => {});
      await page.getByText('AI Analysis').first().waitFor({ timeout: 8000 }).catch(() => {});
      const waitUntil = await ready(500);
      await waitUntil(at('transcribed', 2, -0.3));
      await zoomTo(page, page.getByText(/ai analysis/i).first(), 1.12, 800).catch(() => {});
      await waitUntil(at('in writing', D - 1.2));
      await zoomReset(page);
      await waitUntil(D);
    },
  },

  {
    name: 't4-close', account: ACCT.guest,
    narration: "That's In-Sync ATS: candidates arrive scored, the chasing calls itself, and every conversation is in writing — your recruiters just close hires. Seven ninety-nine per recruiter a month, A.I. calls at three rupees a minute, live in a day. Book your demo — bring an open role.",
    beats: async ({ page, D, ready }) => {
      await page.setContent(CLOSE_HTML, { waitUntil: 'load' });
      const waitUntil = await ready(300);
      await waitUntil(D);
    },
  },
];
