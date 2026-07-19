// In-Sync ATS teaser v3 — "buyer-question" cut, TWO orientations.
//   node scripts/render-teaser.mjs            (SKIP list: FRESH_NARRATION=1, FRESH_VIDEO=1)
// Outputs:
//   C:\Users\Admin\Downloads\ats-teaser.mp4         (1920x1080, laptop/YouTube)
//   C:\Users\Admin\Downloads\ats-teaser-mobile.mp4  (1080x1920, Reels/Shorts/Status)
//
// Story spine (locked with founder 2026-07-19):
//   problem card -> coverage montage (what the platform IS) ->
//   3 differentiators on ONE character thread (Priya the candidate) ->
//   outcome-numbers card -> demo CTA.
// Visual system: brand canvas everywhere; app footage appears only inside
// rounded PROOF WINDOWS with chapter labels — never full-bleed. The same raw
// clips are composited twice: landscape canvas and a portrait re-layout.
import { chromium } from 'playwright';
import { readFileSync, existsSync, writeFileSync } from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, join } from 'path';
import { execFileSync } from 'child_process';
import { loadEnv } from './lib/env.mjs';
import { BASE, candidateUrl, login } from './lib/app.mjs';
import { ACCT, recordSceneVideo } from './lib/scene.mjs';
import { synthTimed } from './lib/voice.mjs';
import * as V from './lib/video.mjs';
import { crossfadeStitchVideo, overlayAudio, holdAndFade } from './lib/video.mjs';
import { zoomTo, zoomReset } from './lib/annotate.mjs';
import { clickLocator } from './lib/cursor.mjs';

const FF = 'C:\\Users\\Admin\\scoop\\shims\\ffmpeg.exe';
const here = dirname(fileURLToPath(import.meta.url));
const dir = join(here, 'recordings', 'scenes');
const T_X = 0.4;

const STATE = JSON.parse(readFileSync(join(here, 'seed-state.json'), 'utf8'));
const { candidateId, orgId, recruiterIds } = STATE;
const AARAV_ID = recruiterIds?.find((r) => r.name === 'Aarav Mehta')?.id;
const LOGO = 'data:image/png;base64,' +
  readFileSync(join(here, '..', 'src', 'assets', 'ats-logo.png')).toString('base64');

const env = loadEnv(new URL('../.env', import.meta.url));
const SB_URL = 'https://htdwkhtfdifwajdkkpul.supabase.co';
const SB_KEY = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY;

// Priya's offer-confirmation call must exist for the "save" proof shot.
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

// ── The 7 narration blocks (slots are carved from ONE take) ───────────────────
const NARR = {
  n0: "Hiring isn't slow at sourcing — it's slow after: screening piles, chasing candidates, offers that go quiet. In-Sync ATS fixes the after.",
  n1: "It runs your whole hiring pipeline in one place — open roles, candidates, screening calls, onboarding.",
  n2a: "One — candidates arrive scored. Priya's résumé files itself, and lands already ranked. Your recruiter judges a list, not a pile.",
  n2b: "Two — the chasing calls itself. The A.I. agent dials Priya's reminder call — three rupees a minute, not a recruiter's afternoon.",
  n2c: "Three — nothing slips. Priya goes quiet before joining. The system catches it — and brings back her yes, in writing.",
  n3: "So the math changes: screening, from hours to minutes. Follow-up calling, from an afternoon to three rupees a minute. Ghosted offers — caught, not discovered. Seven ninety-nine per recruiter a month, live in a day.",
  n4: "In-Sync ATS. Book a thirty-minute demo — bring an open role.",
};
const ORDER = ['n0', 'n1', 'n2a', 'n2b', 'n2c', 'n3', 'n4'];

// ── 1. narration ──────────────────────────────────────────────────────────────
const SEP = ' ';
const fullText = ORDER.map((k) => NARR[k]).join(SEP);
const mp3Path = join(dir, 'teaser3-narration.mp3');
const alignPath = join(dir, 'teaser3-align.json');
let Taud;
if (process.env.FRESH_NARRATION !== '1' && existsSync(mp3Path) && existsSync(alignPath)) {
  const c = JSON.parse(readFileSync(alignPath, 'utf8'));
  if (c.text === fullText) {
    console.log('Reusing cached narration.');
    Taud = { duration: c.duration, joined: c.joined, starts: c.starts, ends: c.ends,
      timeAtChar: (i) => c.starts[Math.max(0, Math.min(i, c.starts.length - 1))] };
  }
}
if (!Taud) {
  console.log(`Synthesizing narration (${fullText.length} chars, 1.0x)...`);
  Taud = await synthTimed(fullText, mp3Path, { speed: 1.0 });
  writeFileSync(alignPath, JSON.stringify({ text: fullText, duration: Taud.duration, joined: Taud.joined, starts: Taud.starts, ends: Taud.ends }));
}
console.log(`Narration ${Taud.duration.toFixed(1)}s`);

let offset = 0;
const slots = {};
for (let i = 0; i < ORDER.length; i++) {
  const k = ORDER[i];
  const charStart = offset, charEnd = offset + NARR[k].length;
  const nextOffset = charEnd + SEP.length;
  const start = Taud.timeAtChar(charStart);
  const end = i < ORDER.length - 1 ? Taud.timeAtChar(nextOffset) : Taud.duration;
  offset = nextOffset;
  const localFind = (phrase) => { const j = Taud.joined.indexOf(phrase.toLowerCase(), charStart); return (j < 0 || j >= charEnd) ? null : Taud.starts[j]; };
  slots[k] = { start, duration: end - start, localFind };
}

// ── 2. PASS A — raw app clips (recorded once, reused by both orientations) ────
// Proof clips are zoomed hard onto the one panel being claimed: they'll be
// shown inside a window, so the panel must fill the frame.
const RAW = [
  // coverage flashes (fixed 4s each; montage shows ~3s of each)
  { name: 'r-cov-mandates', account: ACCT.recruiter, seconds: 4, beats: async ({ page, D, ready }) => {
      await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('link', { name: /^mandates$/i }).first().click().catch(() => {});
      await page.waitForTimeout(1500);
      const waitUntil = await ready(300);
      await page.evaluate(() => window.scrollBy({ top: 120, behavior: 'smooth' }));
      await waitUntil(D);
    } },
  { name: 'r-cov-candidates', account: ACCT.recruiter, seconds: 4, beats: async ({ page, D, ready }) => {
      await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('link', { name: /^candidates$/i }).first().click().catch(() => {});
      await page.waitForTimeout(1500);
      const waitUntil = await ready(300);
      await page.evaluate(() => window.scrollBy({ top: 120, behavior: 'smooth' }));
      await waitUntil(D);
    } },
  { name: 'r-cov-calling', account: ACCT.recruiter, seconds: 4, beats: async ({ page, D, ready }) => {
      await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('link', { name: /calling dashboard/i }).first().click().catch(() => {});
      await page.waitForTimeout(1500);
      const waitUntil = await ready(300);
      await waitUntil(D);
    } },
  { name: 'r-cov-onboard', account: ACCT.recruiter, seconds: 4, beats: async ({ page, D, ready }) => {
      await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('link', { name: /hr onboarding/i }).first().click().catch(() => {});
      await page.waitForTimeout(1500);
      const waitUntil = await ready(300);
      await waitUntil(D);
    } },
  // proof 1 — Priya arrives scored (zoom the AI score card hard)
  { name: 'r-p1-score', account: ACCT.recruiter, slot: 'n2a', beats: async ({ page, at, D, ready }) => {
      await page.goto(candidateUrl(candidateId), { waitUntil: 'networkidle' });
      await page.getByText('Priya Sharma').first().waitFor({ timeout: 20000 });
      await page.getByText(/promising/i).first().waitFor({ timeout: 8000 }).catch(() => {});
      const waitUntil = await ready(500);
      await waitUntil(at('files itself', 3, -0.3));
      await zoomTo(page, page.getByText(/ai candidate score/i).first(), 1.5, 900).catch(() => {});
      await waitUntil(D);
      await zoomReset(page, 200);
    } },
  // proof 2 — the AI dials Priya (hold the dialing console)
  { name: 'r-p2-dial', account: ACCT.recruiter, slot: 'n2b', beats: async ({ page, at, D, ready }) => {
      await page.route('**/functions/v1/ai-screen-candidate', async (route) => {
        const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, OPTIONS' };
        if (route.request().method() === 'OPTIONS') { await route.fulfill({ status: 204, headers: cors }); return; }
        await new Promise((r) => setTimeout(r, 9000));
        await route.fulfill({ status: 200, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify({ execution_id: 'exec_8f3a29d1c740', call_log_id: 'cl_9d1f77' }) });
      });
      await page.goto(candidateUrl(candidateId), { waitUntil: 'networkidle' });
      await page.getByText('Priya Sharma').first().waitFor({ timeout: 20000 });
      await page.getByText(/ai voice calls/i).first().scrollIntoViewIfNeeded().catch(() => {});
      await page.waitForTimeout(400);
      const waitUntil = await ready(400);
      await waitUntil(at('dials', 4, -0.5));
      const startBtn = page.getByRole('button', { name: /start ai call/i }).first();
      await clickLocator(page, startBtn, { dur: 500 }).catch(() => startBtn.click().catch(() => {}));
      await page.getByText(/dialing priya/i).first().waitFor({ timeout: 5000 }).catch(() => {});
      await zoomTo(page, page.getByText(/dialing priya/i).first(), 1.5, 800).catch(() => {});
      await waitUntil(D);
      await zoomReset(page, 200);
    } },
  // proof 3 — the save, in writing (AI analysis of the confirmation call)
  { name: 'r-p3-save', account: ACCT.recruiter, slot: 'n2c', beats: async ({ page, at, D, ready }) => {
      await ensureConfirmationCall();
      await page.goto(candidateUrl(candidateId), { waitUntil: 'networkidle' });
      await page.getByText('Priya Sharma').first().waitFor({ timeout: 20000 });
      const callTab = page.getByRole('tab', { name: 'Call History' });
      await callTab.waitFor({ timeout: 8000 }).catch(() => {});
      await callTab.click().catch(() => {});
      await page.getByText('AI Analysis').first().waitFor({ timeout: 8000 }).catch(() => {});
      const waitUntil = await ready(400);
      await waitUntil(at('catches it', 4, -0.3));
      await zoomTo(page, page.getByText(/ai analysis/i).first(), 1.4, 900).catch(() => {});
      await waitUntil(D);
      await zoomReset(page, 200);
    } },
];

for (const r of RAW) {
  const out = join(dir, `${r.name}-v.mp4`);
  const secs = r.slot ? slots[r.slot].duration : r.seconds;
  if (process.env.FRESH_VIDEO !== '1' && existsSync(out)) {
    try {
      const d = parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', out]).toString().trim());
      if (isFinite(d) && Math.abs(d - (secs + (r.slot ? T_X : 0))) < 0.5) { console.log(`[${r.name}] reuse cached`); continue; }
    } catch {}
  }
  let ok = false, lastErr;
  for (let a = 0; a < 3 && !ok; a++) {
    try {
      await recordSceneVideo({
        scene: { name: r.name, account: r.account, beats: r.beats },
        slotStart: r.slot ? slots[r.slot].start : 0,
        slotDuration: secs,
        localFind: r.slot ? slots[r.slot].localFind : (() => null),
        tailT: r.slot ? T_X : 0,
      });
      ok = true;
    } catch (e) { lastErr = e; console.log(`[${r.name}] attempt ${a + 1} failed: ${e.message.split('\n')[0]}`); }
  }
  if (!ok) throw new Error(`raw clip ${r.name} failed: ${lastErr?.message}`);
}

const b64 = (name) => 'data:video/mp4;base64,' + readFileSync(join(dir, `${name}-v.mp4`)).toString('base64');

// ── 3. PASS B — canvas scenes per orientation ─────────────────────────────────
const CANVAS_BG = `background:
  radial-gradient(900px 500px at 15% -10%,rgba(59,130,246,.28),transparent 60%),
  radial-gradient(800px 500px at 95% 115%,rgba(37,99,235,.30),transparent 55%),
  linear-gradient(135deg,#0a0f1e 0%,#0d1830 55%,#101f42 100%)`;

const baseCss = (o) => `
  *{margin:0;padding:0;box-sizing:border-box}html,body{height:100%}
  body{font-family:'Segoe UI',Arial,sans-serif;color:#e5e9f5;overflow:hidden;${CANVAS_BG}}
  .wrap{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:${o === 'tall' ? '60px 44px 200px' : '56px'}}
  .logocard{background:#fff;border-radius:20px;padding:14px 24px;box-shadow:0 14px 40px rgba(0,0,0,.35)}
  .logocard img{height:${o === 'tall' ? 88 : 66}px;width:auto;display:block}
  .kicker{color:#60a5fa;font-weight:800;font-size:${o === 'tall' ? 26 : 22}px;letter-spacing:2.5px;text-transform:uppercase}
  h1{font-weight:800;letter-spacing:-.02em;line-height:1.1;font-size:${o === 'tall' ? 66 : 64}px}
  h1 .g{color:#60a5fa}
  .sub{color:#9fb0d0;font-size:${o === 'tall' ? 30 : 26}px;line-height:1.45}
  .chip{display:inline-block;background:rgba(96,165,250,.14);border:1px solid rgba(96,165,250,.4);border-radius:999px;
    padding:${o === 'tall' ? '14px 30px' : '10px 24px'};font-size:${o === 'tall' ? 28 : 22}px;font-weight:700;color:#bcd3f7}
  .frame{border-radius:18px;overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,.55);border:1px solid rgba(255,255,255,.14);
    width:${o === 'tall' ? '94%' : '76%'};position:relative;background:#0a0f1e}
  .crop{overflow:hidden;width:100%}
  .crop video{display:block;width:${o === 'tall' ? '140%' : '100%'};margin-left:${o === 'tall' ? '-20%' : '0'}}
  .grid{display:grid;grid-template-columns:1fr 1fr;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:16px;overflow:hidden;text-align:left}
  .grid .l{font-size:${o === 'tall' ? 26 : 21}px;color:rgba(255,255,255,.55);padding:${o === 'tall' ? '18px 22px' : '14px 24px'};display:flex;align-items:center;justify-content:flex-end;text-align:right}
  .grid .r{font-size:${o === 'tall' ? 26 : 21}px;font-weight:600;color:#7fb5f9;padding:${o === 'tall' ? '18px 22px' : '14px 24px'};border-left:1px solid rgba(255,255,255,.15);display:flex;align-items:center}
  .cta{display:inline-block;background:linear-gradient(135deg,#3b82f6,#2563eb);color:#fff;font-weight:700;
    font-size:${o === 'tall' ? 34 : 28}px;padding:${o === 'tall' ? '24px 52px' : '18px 42px'};border-radius:999px;box-shadow:0 12px 30px rgba(37,99,235,.4)}
  .gap-s{margin-top:18px}.gap-m{margin-top:28px}.gap-l{margin-top:38px}
`;

const page5 = (o, inner, script = '') => `<!doctype html><html><head><meta charset="utf-8"><style>${baseCss(o)}</style></head>
<body><div class="wrap">${inner}</div><script>${script}</script></body></html>`;

function cardProblem(o) {
  return page5(o, `
    <div class="logocard"><img src="${LOGO}"/></div>
    <div class="kicker gap-l">In-Sync ATS &middot; Applicant Tracking</div>
    <h1 class="gap-m">Hiring isn&rsquo;t slow at sourcing.<br>It&rsquo;s slow <span class="g">after.</span></h1>
    <div class="sub gap-m">Screening piles &middot; candidate chasing &middot; offers that go quiet.</div>`);
}

function cardCoverage(o, perSec) {
  const labels = ['Open Roles', 'Candidates', 'AI Calling', 'Onboarding'];
  const vids = ['r-cov-mandates', 'r-cov-candidates', 'r-cov-calling', 'r-cov-onboard']
    .map((n, i) => `<video muted playsinline preload="auto" src="${b64(n)}" style="position:absolute;inset:0;opacity:${i === 0 ? 1 : 0};transition:opacity .3s"></video>`)
    .join('');
  return page5(o, `
    <div class="kicker">One platform &middot; the whole pipeline</div>
    <div class="frame gap-m"><div class="crop" style="aspect-ratio:16/9;position:relative">${vids}</div></div>
    <div class="chip gap-m" id="lab">${labels[0]}</div>`, `
    window.__start = () => {
      const vids=[...document.querySelectorAll('video')], lab=document.getElementById('lab');
      const labels=${JSON.stringify(labels)};
      const show=(k)=>{vids.forEach((v,j)=>{v.style.opacity=j===k?1:0; if(j===k){try{v.currentTime=0;v.play();}catch(e){}}else{try{v.pause();}catch(e){}}}); lab.textContent=labels[k];};
      show(0); let i=0;
      const iv=setInterval(()=>{i++; if(i>=4){clearInterval(iv);return;} show(i);}, ${Math.max(1.2, perSec).toFixed(2)}*1000);
    };`);
}

function cardProof(o, clipName, label) {
  return page5(o, `
    <div class="chip">${label}</div>
    <div class="frame gap-m"><div class="crop"><video muted playsinline preload="auto" src="${b64(clipName)}"></video></div></div>`, `
    window.__start = () => { const v=document.querySelector('video'); try{v.play();}catch(e){} };`);
}

function cardNumbers(o) {
  return page5(o, `
    <div class="kicker">The math changes</div>
    <div class="grid gap-m">
      <div class="l">Screening a role</div><div class="r">Hours &rarr; minutes, AI-ranked</div>
      <div class="l">Follow-up calling</div><div class="r">An afternoon &rarr; &#8377;3/min AI agent</div>
      <div class="l">Ghosted offers</div><div class="r">Caught same day &mdash; not at month-end</div>
    </div>
    <div class="sub gap-m" style="color:#e5e9f5;font-weight:600">&#8377;799 per recruiter / month &middot; live in a day</div>`);
}

function cardCta(o) {
  return page5(o, `
    <div class="logocard"><img src="${LOGO}"/></div>
    <h1 class="gap-l" style="font-size:${o === 'tall' ? 58 : 56}px">Recruiters close hires.<br><span class="g">The grind runs itself.</span></h1>
    <div class="cta gap-l">Book your 30-minute demo &rarr;</div>
    <div class="sub gap-m" style="font-size:${o === 'tall' ? 24 : 20}px">In-Sync ATS &middot; part of the In-Sync suite</div>`);
}

async function recordCanvas({ name, html, seconds, vp }) {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: vp, recordVideo: { dir, size: vp } });
  const page = await ctx.newPage();
  const t0 = Date.now();
  await page.setContent(html, { waitUntil: 'load' });
  await page.evaluate(() => Promise.all([...document.querySelectorAll('video')].map((v) =>
    v.readyState >= 3 ? 1 : new Promise((res) => { v.addEventListener('canplaythrough', res, { once: true }); v.addEventListener('error', res, { once: true }); })
  ))).catch(() => {});
  await page.waitForTimeout(250);
  const leadSec = (Date.now() - t0) / 1000;
  await page.evaluate(() => window.__start && window.__start()).catch(() => {});
  await page.waitForTimeout(seconds * 1000);
  await ctx.close(); await browser.close();
  const webm = await page.video().path();
  const mp4 = join(dir, `${name}-v.mp4`);
  V.webmToMp4(webm, mp4, leadSec, seconds);
  console.log(`[${name}] canvas ${seconds.toFixed(2)}s`);
  return mp4;
}

const ORIENTS = [
  { key: 'wide', vp: { width: 1920, height: 1080 }, out: 'C:\\Users\\Admin\\Downloads\\ats-teaser.mp4', subStyle: "FontName=Segoe UI,FontSize=17,Bold=1,BorderStyle=1,Outline=2,Shadow=0,OutlineColour=&H96000000,PrimaryColour=&H00FFFFFF,MarginV=40" },
  // Portrait note: libass scales FontSize/margins against PlayResY=288, so the
  // portrait 1920-high frame multiplies everything by ~6.7 — values must be tiny.
  { key: 'tall', vp: { width: 1080, height: 1920 }, out: 'C:\\Users\\Admin\\Downloads\\ats-teaser-mobile.mp4', subStyle: "FontName=Segoe UI,FontSize=7,Bold=1,BorderStyle=1,Outline=1,Shadow=0,OutlineColour=&H96000000,PrimaryColour=&H00FFFFFF,MarginV=20" },
];

// sentence-level subtitle cues from the TTS timing (teasers get watched muted)
const srtTime = (t) => {
  const ms = Math.max(0, Math.round(t * 1000));
  const h = String(Math.floor(ms / 3600000)).padStart(2, '0');
  const m = String(Math.floor((ms % 3600000) / 60000)).padStart(2, '0');
  const s = String(Math.floor((ms % 60000) / 1000)).padStart(2, '0');
  return `${h}:${m}:${s},${String(ms % 1000).padStart(3, '0')}`;
};
const cues = [];
let cursor = 0;
for (const k of ORDER) {
  for (const raw of NARR[k].split(/(?<=[.!?])\s+/)) {
    const line = raw.trim();
    if (!line) continue;
    const j = Taud.joined.indexOf(line.toLowerCase().slice(0, Math.min(24, line.length)), cursor);
    if (j < 0) continue;
    const start = Taud.timeAtChar(j);
    const end = Taud.timeAtChar(j + line.length - 1) + 0.25;
    cues.push(`${cues.length + 1}\n${srtTime(start)} --> ${srtTime(end)}\n${line}\n`);
    cursor = j + line.length;
  }
}
writeFileSync(join(dir, 'teaser3-subs.srt'), cues.join('\n'), 'utf8');
console.log(`${cues.length} subtitle cues`);

for (const O of ORIENTS) {
  console.log(`\n=== ${O.key} (${O.vp.width}x${O.vp.height}) ===`);
  const covPer = slots.n1.duration / 4;
  const sceneDefs = [
    { k: 'n0', html: cardProblem(O.key) },
    { k: 'n1', html: cardCoverage(O.key, covPer) },
    { k: 'n2a', html: cardProof(O.key, 'r-p1-score', '1 &middot; AI ranks every résumé') },
    { k: 'n2b', html: cardProof(O.key, 'r-p2-dial', '2 &middot; The AI makes the calls') },
    { k: 'n2c', html: cardProof(O.key, 'r-p3-save', '3 &middot; The save, in writing') },
    { k: 'n3', html: cardNumbers(O.key) },
    { k: 'n4', html: cardCta(O.key) },
  ];
  const clips = [];
  for (const sd of sceneDefs) {
    clips.push(await recordCanvas({ name: `c-${sd.k}-${O.key}`, html: sd.html, seconds: slots[sd.k].duration + T_X, vp: O.vp }));
  }
  const silent = join(dir, `teaser3-${O.key}-silent.mp4`);
  crossfadeStitchVideo(clips, silent, T_X);
  const narrated = join(dir, `teaser3-${O.key}-narrated.mp4`);
  overlayAudio(silent, mp3Path, narrated);
  const styled = join(dir, `teaser3-${O.key}-styled.mp4`);
  execFileSync(FF, ['-y', '-i', `teaser3-${O.key}-narrated.mp4`,
    '-vf', `subtitles=teaser3-subs.srt:force_style='${O.subStyle}'`,
    '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-r', '30', '-c:a', 'aac', '-b:a', '192k',
    '-movflags', '+faststart', `teaser3-${O.key}-styled.mp4`], { cwd: dir });
  holdAndFade(styled, O.out, 2.0, 1.0);
  console.log('DONE ->', O.out);
}
