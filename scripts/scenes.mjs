// TechCorp Solutions × In-Sync ATS — sales demo (v2, reworked cut).
// Arc: HOOK → the need → publish → AI MAGIC inside the first minute →
// pipeline → recruiter desk → score → human call → AI call (payoff ON SCREEN) →
// transcript proof → follow-up → stage move → TENSION (silence caught) →
// onboarding close → ROI → differentiation → CTA with a number.
// White-labelled to TechCorp (sidebar logo swapped in lib/scene.mjs).
import { readFileSync, existsSync } from 'fs';
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
const { candidateId, mandateId, orgId, recruiterIds } = STATE;
const AARAV_ID = recruiterIds?.find((r) => r.name === 'Aarav Mehta')?.id;
const RESUME_PDF = join(here, 'assets', 'priya-resume.pdf');
const LOGO_WHITE = 'data:image/png;base64,' +
  readFileSync(join(here, '..', 'src', 'assets', 'techcorp-logo-white.png')).toString('base64');

// ── Live data mutation from inside a scene ────────────────────────────────────
// The tension beat re-creates Priya's offer-confirmation AI call at record time,
// so the earlier transcript scene shows only the screening call (chronology holds).
const env = loadEnv(new URL('../.env', import.meta.url));
const SB_URL = 'https://htdwkhtfdifwajdkkpul.supabase.co';
const SB_KEY = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY;
async function logConfirmationCall() {
  const joinDate = new Date(Date.now() + 10 * 86400000);
  const joinStr = joinDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const now = new Date();
  const res = await fetch(`${SB_URL}/rest/v1/call_logs`, {
    method: 'POST',
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({
      demandcom_id: candidateId, org_id: orgId,
      from_number: 'bolna-ai', to_number: '9876543210',
      status: 'completed', direction: 'outbound-api', call_method: 'bolna',
      bolna_execution_id: `demo-confirm-${candidateId.slice(0, 8)}`,
      conversation_duration: 190, disposition: 'Connected', subdisposition: 'Joining Confirmed',
      transcript: `Agent: Hi Priya, this is the TechCorp hiring assistant. I'm calling about the offer we sent for the Senior Frontend Developer role. Did you get a chance to review it?
Priya: Yes, I did. Sorry, I went quiet — my current company made a counter-offer and I needed a few days.
Agent: Completely understandable. Where did you land?
Priya: I'm declining the counter. TechCorp is the better role. I'm accepting.
Agent: That's great news. Can you confirm your joining date?
Priya: Yes — ${joinStr}. My relieving letter is already in process.
Agent: Perfect. You'll receive the onboarding link today. Anything you need from us before then?
Priya: No, all clear. Thank you for following up.
Agent: Congratulations, Priya. Welcome to TechCorp.`,
      analysis_json: {
        summary: `Priya confirmed she is JOINING on ${joinStr}. Counter-offer from current employer declined; relieving letter in process. Ready for onboarding.`,
        next_step: 'Send onboarding link', interest_level: 'high',
        joining_date: joinStr, notice_period_days: 0,
      },
      analysis_quality_score: 88,
      start_time: now.toISOString(), end_time: new Date(now.getTime() + 190000).toISOString(),
      initiated_by: AARAV_ID,
      created_at: now.toISOString(),
    }),
  });
  if (!res.ok) console.warn('confirmation call insert failed:', res.status, await res.text());
}

async function waitLoaded(page, settle = 500) {
  await page.getByText(/loading data|loading\.\.\./i).first().waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(settle);
}

// Click the newest call's "AI Summary" and make sure the panel ACTUALLY opened —
// a realtime refetch can swallow the first click without an error.
// The app auto-expands the newest AI-analyzed call on the candidate timeline;
// only click if it is somehow closed (check FIRST — a click would toggle it shut).
async function openAiSummary(page) {
  for (let k = 0; k < 4; k++) {
    const open = await page.getByText('AI Analysis').first().isVisible().catch(() => false);
    console.log(`  [openAiSummary] try=${k} panelOpen=${open}`);
    if (open) return true;
    const aiBtn = page.getByRole('button', { name: /ai summary/i }).first();
    await aiBtn.waitFor({ timeout: 8000 }).catch(() => {});
    await clickLocator(page, aiBtn, { dur: 600 }).catch(() => aiBtn.click({ timeout: 3000 }).catch(() => {}));
    await page.waitForTimeout(1000);
  }
  return false;
}

// ── Modern dark slide chrome ──────────────────────────────────────────────────
const SLIDE_HEAD = `<style>
  *{margin:0;padding:0;box-sizing:border-box}html,body{height:100%}
  body{font-family:'Segoe UI',Arial,sans-serif;color:#e5e9f5;overflow:hidden;
    background:radial-gradient(900px 500px at 15% -10%,rgba(59,130,246,.28),transparent 60%),
               radial-gradient(800px 500px at 95% 115%,rgba(37,99,235,.30),transparent 55%),
               linear-gradient(135deg,#0a0f1e 0%,#0d1830 55%,#101f42 100%)}
  .wrap{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:56px}
  .logo{height:58px;width:auto;margin-bottom:40px;opacity:0;animation:fade .7s ease .1s forwards}
  .stat{color:#60a5fa;font-weight:800;font-size:25px;letter-spacing:.02em;margin-bottom:20px;opacity:0;animation:fade .7s ease .3s forwards}
  h1{font-size:74px;line-height:1.06;font-weight:800;letter-spacing:-.02em;opacity:0;transform:translateY(10px);animation:rise .8s cubic-bezier(.2,.7,.2,1) .45s forwards}
  h1 .g{color:#60a5fa}
  .tag{margin-top:26px;font-size:27px;color:#9fb0d0;opacity:0;animation:fade .7s ease .7s forwards}
  .bar{width:0;height:5px;background:#3b82f6;border-radius:3px;margin:36px auto 0;animation:grow .8s ease 1s forwards}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;max-width:1180px;margin-top:16px}
  .card{background:rgba(255,255,255,.05);border:1px solid rgba(96,165,250,.22);border-radius:18px;padding:26px 28px;text-align:left;
    display:flex;gap:16px;align-items:flex-start;opacity:0;transform:translateY(10px);animation:rise .6s cubic-bezier(.2,.7,.2,1) forwards}
  .card .n{color:#60a5fa;font-weight:800;font-size:28px;flex:none}
  .card .t{font-weight:700;font-size:24px}.card .s{color:#9fb0d0;font-size:19px;margin-top:4px}
  .cta{margin-top:38px;display:inline-block;background:linear-gradient(135deg,#3b82f6,#2563eb);color:#fff;font-weight:700;font-size:28px;
    padding:20px 44px;border-radius:999px;box-shadow:0 12px 30px rgba(37,99,235,.4);opacity:0;animation:rise .7s ease .8s forwards}
  .num{margin-top:32px;display:flex;gap:18px;justify-content:center;opacity:0;animation:fade .7s ease .95s forwards}
  .num .chip{background:rgba(96,165,250,.12);border:1px solid rgba(96,165,250,.35);border-radius:14px;padding:13px 24px;font-size:20px;color:#bcd3f7}
  .num .chip b{color:#fff;font-size:24px}
  .foot{margin-top:30px;color:#8296b8;font-size:19px;letter-spacing:.02em;opacity:0;animation:fade .7s ease 1.1s forwards}
  @keyframes fade{to{opacity:1}}@keyframes rise{to{opacity:1;transform:translateY(0)}}@keyframes grow{to{width:120px}}
</style>`;

const OPEN_HTML = `<!doctype html><html><head><meta charset="utf-8">${SLIDE_HEAD}</head><body>
  <div class="wrap">
    <img class="logo" src="${LOGO_WHITE}"/>
    <div class="stat">62% of candidates ghost.</div>
    <h1>Hires aren't lost at sourcing.<br>They're lost <span class="g">between shortlisted and joined.</span></h1>
    <div class="tag">Watch TechCorp close that gap — one hire, end to end.</div>
    <div class="bar"></div>
    <div class="foot">TechCorp Solutions is a client of <b style="color:#e5e9f5">In-Sync ATS</b> — this demo runs on their live workspace.</div>
  </div></body></html>`;

const DIFF_CARDS = [
  ['End to end', 'Requirement to onboarded hire — the back of the funnel most tools ignore.'],
  ['AI does the drudgery', 'Reminder calls, data entry, and document checks — automated.'],
  ['Built for India', 'WhatsApp, click-to-call, PAN · Aadhaar · bank verification, native.'],
  ['One platform', 'Not an ATS plus a CRM plus a dialer plus a verifier. One.'],
].map((c, i) => `<div class="card" style="animation-delay:${(0.3 + i * 0.12).toFixed(2)}s"><div class="n">0${i + 1}</div><div><div class="t">${c[0]}</div><div class="s">${c[1]}</div></div></div>`).join('');
const DIFF_HTML = `<!doctype html><html><head><meta charset="utf-8">${SLIDE_HEAD}</head><body>
  <div class="wrap">
    <div class="stat">Everyone automates sourcing.</div>
    <h1 style="font-size:44px">In-Sync ATS closes <span class="g">the gap.</span></h1>
    <div class="grid">${DIFF_CARDS}</div>
  </div></body></html>`;

const CTA_HTML = `<!doctype html><html><head><meta charset="utf-8">${SLIDE_HEAD}</head><body>
  <div class="wrap">
    <img class="logo" src="${LOGO_WHITE}"/>
    <h1 style="font-size:50px">From an open role<br>to a <span class="g">confirmed hire.</span></h1>
    <div class="tag">Nobody lost to silence.</div>
    <div class="num">
      <div class="chip"><b>2×</b> faster shortlist-to-offer</div>
      <div class="chip"><b>40%</b> fewer offer drop-offs</div>
      <div class="chip"><b>0</b> missed follow-ups</div>
    </div>
    <div class="cta">Book a demo →</div>
    <div class="foot">TechCorp Solutions is a client of In-Sync ATS · part of the In-Sync suite by Prosync</div>
  </div></body></html>`;

export const SCENES = [

  // ── S0: Cold open — the hook ─────────────────────────────────────────────────
  {
    name: 's0-open', account: ACCT.guest,
    narration: "Sixty-two percent of candidates ghost. And most hires aren't lost at sourcing — they're lost in the gap between shortlisted and joined. This is how TechCorp Solutions — a client running on In-Sync ATS — closes that gap. One hire, end to end — starting now.",
    beats: async ({ page, D, ready }) => {
      await page.setContent(OPEN_HTML, { waitUntil: 'load' });
      const waitUntil = await ready(300);
      await waitUntil(D);
    },
  },

  // ── S0b: Command center — the whole desk on one screen ──────────────────────
  {
    name: 's0b-dashboard', account: ACCT.admin,
    narration: "First, thirty seconds of context. This is the command center: open roles, fill rate, every candidate in play, calls made this month, and how each mandate is moving. Everything you're about to watch lands on this one screen, live.",
    beats: async ({ page, at, D, ready }) => {
      await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' });
      await page.getByText(/ats dashboard/i).first().waitFor({ timeout: 20000 }).catch(() => {});
      await waitLoaded(page, 800);
      const waitUntil = await ready(900);
      await waitUntil(at('open roles', 5, -0.3));
      await zoomTo(page, page.getByText(/open positions/i).first(), 1.1, 900).catch(() => {});
      await waitUntil(at('how each mandate', D - 5, -0.3));
      await zoomReset(page);
      await zoomTo(page, page.getByText(/mandate pipeline progression/i).first(), 1.1, 800).catch(() => {});
      await waitUntil(at('live', D - 1));
      await zoomReset(page);
      await waitUntil(D);
    },
  },

  // ── S1: The need — a role opens this morning ─────────────────────────────────
  {
    name: 's1-requirement', account: ACCT.admin,
    narration: "This morning, TechCorp opened a role: Senior Frontend Developer. Three seats, eight to eighteen lakhs, three weeks to close. From the moment it's raised, the whole team works from this one record — skills, salary band, deadline. No stale job descriptions.",
    beats: async ({ page, at, D, ready }) => {
      await page.goto(mandateId ? `${BASE}/mandates/view/${mandateId}` : `${BASE}/mandates`, { waitUntil: 'networkidle' });
      await page.getByText(/frontend developer/i).first().waitFor({ timeout: 20000 }).catch(() => {});
      await waitLoaded(page);
      const waitUntil = await ready(900);
      await waitUntil(at('three seats', 5, -0.3));
      await zoomTo(page, page.getByText(/job requirements/i).first(), 1.15, 900).catch(() => {});
      await waitUntil(at('salary band', D - 3));
      await zoomReset(page);
      await waitUntil(D);
    },
  },

  // ── S2: Publish — hero job visibly on TOP of the careers page ───────────────
  {
    name: 's2-careers', account: ACCT.guest,
    narration: "One click publishes it to the branded careers page — right at the top, with its own apply link. Share it on LinkedIn, WhatsApp, or any job board. Candidates apply in seconds. No account, no login.",
    beats: async ({ page, at, D, ready }) => {
      await page.goto(`${BASE}/careers/techcorp`, { waitUntil: 'networkidle' });
      const heroCard = page.getByText('Senior Frontend Developer').first();
      await heroCard.waitFor({ timeout: 20000 }).catch(() => {});
      await waitLoaded(page);
      const waitUntil = await ready(1000);
      await waitUntil(at('right at the top', 4, -0.3));
      await heroCard.scrollIntoViewIfNeeded().catch(() => {});
      await zoomTo(page, heroCard, 1.18, 900).catch(() => {});
      await waitUntil(at('candidates apply', D - 3));
      await zoomReset(page);
      await waitUntil(D);
    },
  },

  // ── S3: THE MAGIC (inside the first minute) — AI résumé auto-fill, live ─────
  {
    name: 's3-ai-autofill', account: ACCT.admin,
    narration: "Priya Sharma clicks that link and applies. Now — on the recruiter's side — here's the part that normally eats an afternoon: the data entry. Watch. Her résumé goes in… the AI reads the whole thing… and fills the profile itself. Name, contact, salary, skills, experience. Seconds. Not one keystroke.",
    beats: async ({ page, at, D, ready }) => {
      await page.goto(`${BASE}/candidates/new`, { waitUntil: 'networkidle' });
      await page.getByText(/resume upload|ai auto-fill|new candidate/i).first().waitFor({ timeout: 20000 }).catch(() => {});
      await waitLoaded(page);
      const waitUntil = await ready(800);
      await waitUntil(at('the data entry', 8, -0.3));
      if (existsSync(RESUME_PDF)) {
        await page.locator('input[type="file"]').first().setInputFiles(RESUME_PDF).catch(() => {});
        await page.waitForTimeout(700);
        await waitUntil(at('goes in', 11, -0.2));
        const parseBtn = page.getByRole('button', { name: /upload & parse/i }).first();
        await clickLocator(page, parseBtn, { dur: 600 }).catch(() => parseBtn.click().catch(() => {}));
        for (let i = 0; i < 40; i++) {
          const v = await page.locator('input[name="first_name"]').inputValue().catch(() => '');
          if (v && v.trim()) break;
          await page.waitForTimeout(600);
        }
      }
      // No mouse.wheel here — window scrolling drags the sidebar up and leaves
      // white space beneath it on camera. scrollIntoViewIfNeeded only scrolls
      // when the target is actually off screen (rare at 1080p).
      await page.getByText(/basic information/i).first().scrollIntoViewIfNeeded().catch(() => {});
      await page.waitForTimeout(400);
      await zoomTo(page, page.getByText(/basic information/i).first(), 1.1, 900).catch(() => {});
      await waitUntil(at('not one keystroke', D - 1.2));
      await zoomReset(page);
      await waitUntil(D);
    },
  },

  // ── S3b: Bulk import — a whole job-board batch at once ──────────────────────
  {
    name: 's3b-bulk', account: ACCT.admin,
    narration: "That was one résumé. A job-board dump works exactly the same way — bulk upload takes a whole CSV, or a stack of résumés, in one go. The same A.I. parses and files every single one.",
    beats: async ({ page, at, D, ready }) => {
      await page.goto(`${BASE}/candidates`, { waitUntil: 'networkidle' });
      await page.getByText(/candidates/i).first().waitFor({ timeout: 20000 });
      await waitLoaded(page);
      const waitUntil = await ready(900);
      await waitUntil(at('bulk upload', 6, -0.5));
      const bulkBtn = page.getByRole('button', { name: /bulk upload/i }).first();
      await clickLocator(page, bulkBtn, { dur: 700 }).catch(() => bulkBtn.click().catch(() => {}));
      await page.getByText(/bulk import candidates/i).first().waitFor({ timeout: 6000 }).catch(() => {});
      await waitUntil(at('every single one', D - 1.5));
      await page.keyboard.press('Escape').catch(() => {});
      await waitUntil(D);
    },
  },

  // ── S4: One pipeline — search WORKS, rated, assigned ─────────────────────────
  {
    name: 's4-pipeline', account: ACCT.admin,
    narration: "She lands in one pipeline with every other candidate — referred, sourced, or imported. Search for Priya — there she is: scored by the A.I., rated, tagged to the TechCorp role, and already assigned to her recruiter, Aarav. Nothing sits in a spreadsheet, and nobody picks from a pile.",
    beats: async ({ page, at, D, ready }) => {
      await page.goto(`${BASE}/candidates`, { waitUntil: 'networkidle' });
      await page.getByText(/candidates/i).first().waitFor({ timeout: 20000 });
      await waitLoaded(page);
      const waitUntil = await ready(900);
      await waitUntil(at('search for priya', 7, -0.5));
      const filtersBtn = page.getByRole('button', { name: /^filters$/i }).first();
      await clickLocator(page, filtersBtn, { dur: 500 }).catch(() => filtersBtn.click().catch(() => {}));
      await page.waitForTimeout(600);
      const search = page.getByPlaceholder(/search by name, phone/i).first();
      await search.pressSequentially('Priya', { delay: 120 }).catch(() => search.fill('Priya').catch(() => {}));
      await waitLoaded(page, 900);
      await waitUntil(at('there she is', 11, -0.2));
      await zoomTo(page, page.getByText('Priya Sharma').first(), 1.15, 800).catch(() => {});
      await waitUntil(at('picks from a pile', D - 1));
      await zoomReset(page);
      await waitUntil(D);
    },
  },

  // ── S5: The recruiter's desk — Priya flagged for action today ────────────────
  {
    name: 's5-my-desk', account: ACCT.recruiter,
    narration: "Aarav starts his day on My Desk. Not the whole database — just his candidates, sorted by urgency, each one carrying its next action. And there's Priya: flagged, call today. He opens the app knowing exactly what today looks like.",
    beats: async ({ page, at, D, ready }) => {
      await page.goto(`${BASE}/my-desk`, { waitUntil: 'networkidle' });
      await page.getByText(/my desk|action today/i).first().waitFor({ timeout: 20000 });
      await waitLoaded(page);
      const waitUntil = await ready(1000);
      await waitUntil(at('his candidates', 5, -0.3));
      await zoomTo(page, page.getByText(/action today/i).first(), 1.12, 900).catch(() => {});
      await waitUntil(at("there's priya", D - 5));
      await zoomReset(page);
      await page.getByText('Priya Sharma').first().scrollIntoViewIfNeeded().catch(() => {});
      await zoomTo(page, page.getByText('Priya Sharma').first(), 1.18, 800).catch(() => {});
      await waitUntil(at('call today', D - 2));
      await zoomReset(page);
      await waitUntil(D);
    },
  },

  // ── S6: AI candidate score — is she worth the time? ──────────────────────────
  {
    name: 's6-ai-score', account: ACCT.recruiter,
    narration: "He opens her profile, and the first question on any desk is already answered, right at the top: is she worth the time? Sixty-one out of a hundred — Promising — broken down by interview stage, call engagement, profile depth, and application quality. No separate report to open; it lives with her details.",
    beats: async ({ page, at, D, ready }) => {
      await page.goto(candidateId ? candidateUrl(candidateId) : `${BASE}/candidates`, { waitUntil: 'networkidle' });
      await page.getByText('Priya').first().waitFor({ timeout: 20000 });
      await page.getByText(/promising/i).first().waitFor({ timeout: 8000 }).catch(() => {});
      const waitUntil = await ready(900);
      await waitUntil(at('already answered', 5, -0.3));
      await zoomTo(page, page.getByText(/ai candidate score/i).first(), 1.12, 900).catch(() => {});
      await waitUntil(at('application quality', D - 4));
      await zoomReset(page);
      await waitUntil(at('lives with her details', D - 1));
      await waitUntil(D);
    },
  },

  // ── S7: The human call — assessment stays with the recruiter ─────────────────
  {
    name: 's7-assessment', account: ACCT.recruiter,
    narration: "So Aarav makes the call only a person can make — the assessment. Motivation, fit, what's between the lines. One tap connects the call and logs it against her record automatically. That's the recruiter's craft, and it stays with the recruiter.",
    beats: async ({ page, at, D, ready }) => {
      await page.goto(candidateId ? candidateUrl(candidateId) : `${BASE}/candidates`, { waitUntil: 'networkidle' });
      await page.getByText('Priya').first().waitFor({ timeout: 20000 });
      const waitUntil = await ready(900);
      await waitUntil(at('the assessment', 5, -0.3));
      const callBtn = page.getByRole('button', { name: /^call$/i }).first();
      await clickLocator(page, callBtn, { dur: 700 }).catch(() => callBtn.click().catch(() => {}));
      await page.waitForTimeout(1800);
      await waitUntil(at('stays with the recruiter', D - 1.2));
      await page.keyboard.press('Escape').catch(() => {});
      await waitUntil(D);
    },
  },

  // ── S8: AI voice call — click lands, payoff HELD on screen ───────────────────
  {
    name: 's8-ai-call', account: ACCT.recruiter,
    narration: "The repetitive calls — reminders, confirmations, follow-ups — don't touch his desk at all. They go to the A.I. voice agent. One click. Watch the dialer: it's ringing Priya right now, runs the conversation, and captures everything — while Aarav works the rest of his queue. And the call is away. No scheduling. No blocked calendar.",
    beats: async ({ page, at, D, ready }) => {
      // Video-only stub: the app's real UI states (dialer console → AI Call
      // Initiated) play out without placing a live Bolna call.
      await page.route('**/functions/v1/ai-screen-candidate', async (route) => {
        const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, OPTIONS' };
        if (route.request().method() === 'OPTIONS') { await route.fulfill({ status: 204, headers: cors }); return; }
        await new Promise((r) => setTimeout(r, 4500)); // hold the dialer console so it reads
        await route.fulfill({
          status: 200,
          headers: { ...cors, 'content-type': 'application/json' },
          body: JSON.stringify({ execution_id: 'exec_8f3a29d1c740', call_log_id: 'cl_9d1f77' }),
        });
      });
      await page.goto(candidateId ? candidateUrl(candidateId) : `${BASE}/candidates`, { waitUntil: 'networkidle' });
      await page.getByText('Priya').first().waitFor({ timeout: 20000 });
      await page.getByText(/promising/i).first().waitFor({ timeout: 8000 }).catch(() => {});
      const waitUntil = await ready(800);
      await page.getByText(/ai voice calls/i).first().scrollIntoViewIfNeeded().catch(() => {});
      await page.waitForTimeout(500);
      await zoomTo(page, page.getByText(/ai voice calls/i).first(), 1.12, 900).catch(() => {});
      await waitUntil(at('one click', 11, -0.4));
      // The payoff: click → dialer console (pulsing rings, name + number) → AI Call Initiated.
      const startBtn = page.getByRole('button', { name: /start ai call/i }).first();
      await clickLocator(page, startBtn, { dur: 600 }).catch(() => startBtn.click().catch(() => {}));
      await page.getByText(/dialing priya/i).first().waitFor({ timeout: 5000 }).catch(() => {});
      await zoomReset(page);
      await zoomTo(page, page.getByText(/dialing priya/i).first(), 1.2, 700).catch(() => {});
      await waitUntil(at('and the call is away', D - 5, -0.3));
      await page.getByText(/ai call initiated/i).first().waitFor({ timeout: 10000 }).catch(() => {});
      await zoomReset(page);
      await zoomTo(page, page.getByText(/ai call initiated/i).first(), 1.15, 700).catch(() => {});
      await waitUntil(at('no scheduling', D - 1.5));
      await zoomReset(page);
      await waitUntil(D);
    },
  },

  // ── S9: The proof — transcript + AI summary OPENED on screen ─────────────────
  {
    name: 's9-transcript', account: ACCT.recruiter,
    narration: "And when that call ends, it comes back readable. Full transcript on the left. The AI's read on the right: interest high, expecting twelve lakhs, thirty days' notice — next step, send the offer. Quality score: eighty-two. Nobody re-listens to recordings. Nobody writes a note. The first screen is simply done.",
    beats: async ({ page, at, D, ready }) => {
      await page.goto(candidateId ? candidateUrl(candidateId) : `${BASE}/candidates`, { waitUntil: 'networkidle' });
      await page.getByText('Priya').first().waitFor({ timeout: 20000 });
      const waitUntil = await ready(800);
      const callTab = page.getByRole('tab', { name: 'Call History' });
      await callTab.waitFor({ timeout: 8000 }).catch(() => {});
      await clickLocator(page, callTab, { dur: 500 }).catch(() => callTab.click().catch(() => {}));
      await waitLoaded(page, 800);
      // Open the AI analysis panel on the screening call
      await openAiSummary(page);
      await waitUntil(at('full transcript', 6, -0.4));
      await zoomTo(page, page.getByText(/^transcript$/i).first(), 1.1, 900).catch(() => {});
      await waitUntil(at("the ai's read", 10, -0.2));
      await zoomReset(page);
      await zoomTo(page, page.getByText(/ai analysis/i).first(), 1.12, 900).catch(() => {});
      await waitUntil(at('eighty-two', D - 5));
      await zoomReset(page);
      await waitUntil(D);
    },
  },

  // ── S9b: Calling dashboard — mission control for volume days ────────────────
  {
    name: 's9b-calling', account: ACCT.admin,
    narration: "And on a heavy sourcing day, this is mission control: today's calls, connect rate, callbacks due, and every outcome logged as a disposition — across the whole team, live. High-volume calling without losing a single result.",
    beats: async ({ page, at, D, ready }) => {
      await page.goto(`${BASE}/calling-dashboard`, { waitUntil: 'networkidle' });
      await page.getByText(/calling dashboard/i).first().waitFor({ timeout: 20000 }).catch(() => {});
      await waitLoaded(page, 800);
      const waitUntil = await ready(900);
      await waitUntil(at("today's calls", 5, -0.4));
      await zoomTo(page, page.getByText(/today's calls/i).first(), 1.1, 900).catch(() => {});
      await waitUntil(at('every outcome logged', D - 6, -0.3));
      await zoomReset(page);
      await zoomTo(page, page.getByText(/recent call activity/i).first(), 1.08, 800).catch(() => {});
      await waitUntil(at('single result', D - 1.2));
      await zoomReset(page);
      await waitUntil(D);
    },
  },

  // ── S10: Follow-through — offer out from one screen ──────────────────────────
  {
    name: 's10-followup', account: ACCT.recruiter,
    narration: "The offer goes out the same hour, from the same screen. A WhatsApp confirming her details. The formal offer letter by email — branded, personalized, tracked. Every touchpoint lands on her timeline, time-stamped. Nothing is left to anyone's memory.",
    beats: async ({ page, at, D, ready }) => {
      await page.goto(candidateId ? candidateUrl(candidateId) : `${BASE}/candidates`, { waitUntil: 'networkidle' });
      await page.getByText('Priya').first().waitFor({ timeout: 20000 });
      const waitUntil = await ready(800);
      const wa = page.getByRole('button', { name: /whatsapp/i }).first();
      await waitUntil(at('a whatsapp', 6, -0.5));
      await clickLocator(page, wa, { dur: 600 }).catch(() => {});
      await page.waitForTimeout(2200); await page.keyboard.press('Escape').catch(() => {});
      const em = page.getByRole('button', { name: /email/i }).first();
      await waitUntil(at('formal offer letter', D - 8));
      await clickLocator(page, em, { dur: 600 }).catch(() => {});
      await page.waitForTimeout(2600); await page.keyboard.press('Escape').catch(() => {});
      await waitUntil(at('time-stamped', D - 1.5));
      await waitUntil(D);
    },
  },

  // ── S10b: Templates library — nothing retyped twice ──────────────────────────
  {
    name: 's10b-templates', account: ACCT.admin,
    narration: "None of those messages were typed from scratch. They live in a template library — offer letters, interview invites, WhatsApp follow-ups — with personalization tags that fill in the candidate's details by themselves.",
    beats: async ({ page, at, D, ready }) => {
      await page.goto(`${BASE}/templates`, { waitUntil: 'networkidle' });
      await page.getByText(/^templates$/i).first().waitFor({ timeout: 20000 }).catch(() => {});
      await waitLoaded(page, 800);
      const waitUntil = await ready(900);
      await waitUntil(at('template library', 6, -0.4));
      await zoomTo(page, page.getByText(/email templates/i).first(), 1.1, 900).catch(() => {});
      await waitUntil(at('whatsapp follow-ups', D - 5, -0.3));
      await zoomReset(page);
      const waTab = page.getByRole('tab', { name: /whatsapp/i }).first();
      await clickLocator(page, waTab, { dur: 500 }).catch(() => waTab.click().catch(() => {}));
      await page.waitForTimeout(800);
      await waitUntil(at('by themselves', D - 1));
      await waitUntil(D);
    },
  },

  // ── S11: Stage move — one click on the profile, matching the words ───────────
  {
    name: 's11-stage', account: ACCT.recruiter,
    narration: "Moving her forward is one click, right on the profile. Interview… to Offer. The badge updates, the change is logged, and the whole team sees where she stands — without asking anyone.",
    beats: async ({ page, at, D, ready }) => {
      await page.goto(candidateId ? candidateUrl(candidateId) : `${BASE}/candidates`, { waitUntil: 'networkidle' });
      await page.getByText('Priya').first().waitFor({ timeout: 20000 });
      await waitLoaded(page);
      const waitUntil = await ready(900);
      await waitUntil(at('one click', 3, -0.3));
      const stageSel = page.getByRole('combobox', { name: /move stage/i }).first();
      await clickLocator(page, stageSel, { dur: 600 }).catch(() => stageSel.click().catch(() => {}));
      await page.waitForTimeout(700);
      await page.getByRole('option', { name: 'Offer' }).click({ timeout: 4000 }).catch(() => {});
      await page.getByText(/stage updated to offer/i).first().waitFor({ timeout: 5000 }).catch(() => {});
      await waitUntil(at('the badge updates', D - 4));
      await zoomTo(page, page.getByText('Priya Sharma', { exact: false }).first(), 1.15, 800).catch(() => {});
      await waitUntil(at('without asking', D - 1));
      await zoomReset(page);
      await waitUntil(D);
    },
  },

  // ── S12a: TENSION — she goes quiet; the system flags it ──────────────────────
  {
    name: 's12a-silence', account: ACCT.recruiter,
    narration: "Then… the part every recruiter dreads. The offer is out — and Priya goes quiet. Days pass. This silence is exactly where most hires die. Not here. Her follow-up is already flagged on Aarav's desk — and the A.I. agent quietly redials her before anything slips.",
    beats: async ({ page, at, D, ready }) => {
      await page.goto(`${BASE}/my-desk`, { waitUntil: 'networkidle' });
      await page.getByText(/my desk|action today/i).first().waitFor({ timeout: 20000 });
      await waitLoaded(page);
      const waitUntil = await ready(900);
      await waitUntil(at('goes quiet', 6, -0.3));
      await page.getByText('Priya Sharma').first().scrollIntoViewIfNeeded().catch(() => {});
      await zoomTo(page, page.getByText('Priya Sharma').first(), 1.18, 900).catch(() => {});
      await waitUntil(at('quietly redials', D - 2));
      await zoomReset(page);
      await waitUntil(D);
    },
  },

  // ── S12b: THE SAVE — confirmation lands in writing (page load happens in the
  //          trimmed lead, so no loaders appear on camera) ─────────────────────
  {
    name: 's12b-save', account: ACCT.recruiter,
    narration: "Minutes later, it's back in writing. Joining confirmed. Counter-offer declined. Relieving letter in process. The save happened on time — because the system was keeping watch, not somebody's memory.",
    beats: async ({ page, at, D, ready }) => {
      // The AI redial "happens" now — the confirmation call lands in her history.
      await logConfirmationCall();
      // Everything below runs BEFORE ready(): the navigation, tab switch, and
      // data load are all trimmed out of the recording — no loaders on camera.
      await page.goto(candidateId ? candidateUrl(candidateId) : `${BASE}/candidates`, { waitUntil: 'networkidle' }).catch(() => {});
      await page.getByText('Priya').first().waitFor({ timeout: 20000 }).catch(() => {});
      const callTab = page.getByRole('tab', { name: 'Call History' });
      await callTab.waitFor({ timeout: 8000 }).catch(() => {});
      await callTab.click().catch(() => {});
      await waitLoaded(page, 700);
      await openAiSummary(page);
      await page.getByText(/joining confirmed/i).first().waitFor({ timeout: 6000 }).catch(() => {});
      const waitUntil = await ready(600);
      // Keep-alive hold: re-open instantly if anything collapses the panel.
      const tKeep = at('keeping watch', D - 1.5);
      await zoomTo(page, page.getByText(/ai analysis/i).first(), 1.12, 900).catch(() => {});
      for (let t = 3; t < tKeep; t += 1) {
        await waitUntil(t);
        if (!(await page.getByText('AI Analysis').first().isVisible().catch(() => false))) {
          console.log('  [s12b] panel collapsed — re-opening');
          await zoomReset(page);
          await openAiSummary(page);
          await zoomTo(page, page.getByText(/ai analysis/i).first(), 1.12, 600).catch(() => {});
        }
      }
      await waitUntil(tKeep);
      await zoomReset(page);
      await waitUntil(D);
    },
  },

  // ── S13a: The candidate's side — one link, no email attachments ─────────────
  {
    name: 's13a-join', account: ACCT.guest,
    narration: "Priya's side of onboarding is one link on her phone. Personal details, government IDs, bank information, document uploads — all in a single guided form. No email attachments, no chasing, no back and forth.",
    beats: async ({ page, at, D, ready }) => {
      await page.goto(`${BASE}/join/onboard-insync-2026`, { waitUntil: 'networkidle' });
      await page.getByText(/onboarding|personal|new hire/i).first().waitFor({ timeout: 20000 }).catch(() => {});
      await waitLoaded(page, 800);
      const waitUntil = await ready(900);
      await waitUntil(at('one link', 4, -0.3));
      await page.mouse.wheel(0, 500);
      await page.waitForTimeout(600);
      await waitUntil(at('document uploads', D - 5, -0.3));
      await page.mouse.wheel(0, 600);
      await page.waitForTimeout(500);
      await waitUntil(at('back and forth', D - 1));
      await waitUntil(D);
    },
  },

  // ── S13: Close it out — onboarding + AI document verify ──────────────────────
  {
    name: 's13-onboarding', account: ACCT.admin,
    narration: "'Yes' still isn't 'joined' until the paperwork clears. Priya uploads everything once — PAN, Aadhaar, bank details, her resignation and relieving letter, and three months of salary slips. The A.I. verifies every document: identity checked, exit paperwork confirmed, salary credits matched against her bank statement. One click, and she's officially onboarded. Requirement opened, hire closed, record complete.",
    beats: async ({ page, at, D, ready }) => {
      await page.goto(`${BASE}/hr-onboarding`, { waitUntil: 'networkidle' });
      await page.getByText(/onboarding/i).first().waitFor({ timeout: 20000 });
      await waitLoaded(page);
      const waitUntil = await ready(1000);
      await waitUntil(at('paperwork clears', 4, -0.3));
      const eye = page.getByRole('button', { name: /view details/i }).first();
      await clickLocator(page, eye, { dur: 600 }).catch(() => eye.click().catch(() => {}));
      await page.waitForTimeout(1300);
      await waitLoaded(page, 500);
      await waitUntil(at('verifies every document', D - 11));
      // Frame the widened findings checklist: identity + exit paperwork + salary trail
      await page.getByText(/resignation & relieving/i).first().scrollIntoViewIfNeeded().catch(() => {});
      await page.waitForTimeout(400);
      await zoomTo(page, page.getByText(/resignation & relieving/i).first(), 1.1, 800).catch(() => {});
      await waitUntil(at('one click', D - 4.5));
      await zoomReset(page);
      const ap = page.getByRole('button', { name: /approve/i }).first();
      await ap.scrollIntoViewIfNeeded().catch(() => {});
      await clickLocator(page, ap, { dur: 700 }).catch(() => ap.click().catch(() => {}));
      await page.waitForTimeout(1000);
      await waitUntil(at('record complete', D - 1));
      await waitUntil(D);
    },
  },

  // ── S14: Zoom out — management ROI on live numbers ────────────────────────────
  {
    name: 's14-performance', account: ACCT.admin,
    narration: "That's one hire. Multiply it across the team, and the same data answers the question managers actually ask: what are we getting back? Calls made, connect rate, offers out, and who actually joined — per recruiter, live, no status meeting required. Follow-through stops being guesswork and becomes a number.",
    beats: async ({ page, at, D, ready }) => {
      await page.goto(`${BASE}/recruiter-performance`, { waitUntil: 'networkidle' });
      await page.getByText(/performance|recruiter/i).first().waitFor({ timeout: 20000 });
      await waitLoaded(page, 800);
      const waitUntil = await ready(1000);
      await waitUntil(at('multiply it across the team', 5, -0.3));
      // No window scroll (it drags the sidebar up on camera) — zoom the
      // leaderboard card instead; at 1080p it is already in frame.
      await zoomTo(page, page.getByText(/recruiter leaderboard/i).first(), 1.12, 900).catch(() => {});
      await waitUntil(at('becomes a number', D - 1.2));
      await zoomReset(page);
      await waitUntil(D);
    },
  },

  // ── S14b: Teams & roles — who sees what, configured once ────────────────────
  {
    name: 's14b-teams', account: ACCT.admin,
    narration: "And all of it respects roles. Recruiters see their own desk; managers see everything. Users, teams, and even the pipeline stages themselves are configured once, in minutes — then the system simply enforces them.",
    beats: async ({ page, at, D, ready }) => {
      await page.goto(`${BASE}/teams`, { waitUntil: 'networkidle' });
      await page.getByText(/team management|talent acquisition/i).first().waitFor({ timeout: 20000 }).catch(() => {});
      await waitLoaded(page, 800);
      const waitUntil = await ready(900);
      await waitUntil(at('respects roles', 4, -0.3));
      await zoomTo(page, page.getByText(/talent acquisition alpha/i).first(), 1.12, 900).catch(() => {});
      await waitUntil(at('configured once', D - 3.5, -0.3));
      await zoomReset(page);
      await waitUntil(at('enforces them', D - 1));
      await waitUntil(D);
    },
  },

  // ── S15: Why In-Sync wins — differentiation ──────────────────────────────────
  {
    name: 's15-diff', account: ACCT.guest,
    narration: "Most tools automate the front of the funnel — sourcing and screening. In-Sync ATS closes the back, where hires are actually lost. An A.I. that makes the reminder calls, does the data entry, and verifies every document. End to end. Built for India. One platform.",
    beats: async ({ page, D, ready }) => {
      await page.setContent(DIFF_HTML, { waitUntil: 'load' });
      const waitUntil = await ready(300);
      await waitUntil(D);
    },
  },

  // ── S16: CTA — close on numbers ──────────────────────────────────────────────
  {
    name: 's16-cta', account: ACCT.guest,
    narration: "From a role opened in the morning to a hire confirmed in writing — with nobody lost to silence. Teams on In-Sync ATS move from shortlist to offer twice as fast, and cut offer drop-offs by forty percent. See it run on your own pipeline. Book a demo.",
    beats: async ({ page, D, ready }) => {
      await page.setContent(CTA_HTML, { waitUntil: 'load' });
      const waitUntil = await ready(300);
      await waitUntil(D);
    },
  },
];
