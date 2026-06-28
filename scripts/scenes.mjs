// ATS walkthrough — 9 scenes, ~6 min.
// Story arc: Priya Sharma's journey from referral link to verified, onboarded hire.
// Narration is written first; beats() are keyed to spoken words via at('word').
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { BASE, candidateUrl, applyUrl, joinUrl } from './lib/app.mjs';
import { ACCT } from './lib/scene.mjs';
import { ring, removeAnn, caption, removeCaption, zoomTo, zoomReset } from './lib/annotate.mjs';
import { clickLocator, moveToLocator } from './lib/cursor.mjs';

const here = dirname(fileURLToPath(import.meta.url));

// IDs written by seed-ats.mjs
let STATE = {};
try { STATE = JSON.parse(readFileSync(join(here, 'seed-state.json'), 'utf8')); }
catch { console.warn('seed-state.json not found — run seed-ats.mjs first'); }

const { candidateId, referralCode, formSlug } = STATE;

export const SCENES = [

  // ── S0: Dashboard intro ─────────────────────────────────────────────────────
  {
    name: 's0-dashboard',
    account: ACCT.admin,
    narration: 'Finding great people is only half the battle. The other half is moving fast enough to close them. This is In-Sync ATS — a full recruitment command center that tracks every candidate, every conversation, and every next step, from first application all the way to joining day.',
    beats: async ({ page, at, D, ready }) => {
      await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' });
      await page.getByText('Dashboard').first().waitFor({ timeout: 20000 });
      const waitUntil = await ready(1200);

      const cap = await caption(page, 'In-Sync ATS — Recruitment Command Center');
      await waitUntil(at('command center', 6, -0.3));
      const statsCard = page.locator('.grid').first();
      const rStats = await ring(page, statsCard, { label: 'Live pipeline metrics' }).catch(() => null);
      await waitUntil(at('every candidate', 9, -0.2));
      if (rStats) await removeAnn(page, rStats);
      await zoomTo(page, page.getByText('Total Candidates').first().catch(() => statsCard), 1.25, 900).catch(() => {});
      await waitUntil(at('joining day', D - 1.5));
      await zoomReset(page);
      await removeCaption(page, cap);
      await waitUntil(D);
    },
  },

  // ── S1: Candidate applies via referral link ─────────────────────────────────
  {
    name: 's1-apply',
    account: ACCT.guest,
    narration: 'It starts here. Priya Sharma just clicked the referral link her friend shared. She uploads her resume and within seconds the AI parses it — name, contact, current and expected CTC, skills, years of experience — no manual data entry, no copy-paste, no recruiter time wasted. Priya lands directly in the pipeline, fully profiled and ready for review.',
    beats: async ({ page, at, D, ready }) => {
      const url = referralCode ? applyUrl(referralCode) : `${BASE}/apply/demo`;
      await page.goto(url, { waitUntil: 'networkidle' });
      // Wait for the job listing / apply form to render
      await page.getByText(/apply/i).first().waitFor({ timeout: 20000 });
      const waitUntil = await ready(1000);

      const cap = await caption(page, 'Candidate Referral Link — no login required');
      await waitUntil(at('referral link', 4, -0.2));

      // Highlight the upload / apply area
      const uploadArea = page.locator('input[type="file"]').first().locator('..');
      const rUpload = await ring(page, uploadArea.or(page.locator('button').filter({ hasText: /upload/i }).first()), { label: 'Resume upload' }).catch(() => null);
      await waitUntil(at('parses it', 8, -0.2));
      if (rUpload) await removeAnn(page, rUpload);

      const rSkills = await ring(page, page.getByText(/skills/i).first(), { label: 'AI-extracted skills' }).catch(() => null);
      await waitUntil(at('recruiter time wasted', 14, -0.2));
      if (rSkills) await removeAnn(page, rSkills);

      await removeCaption(page, cap);
      await waitUntil(D);
    },
  },

  // ── S2: AI scores the candidate ─────────────────────────────────────────────
  {
    name: 's2-score',
    account: ACCT.admin,
    narration: 'The moment Priya\'s profile lands, the system scores her automatically. Sixty-one out of a hundred — Promising. The score breaks down across four dimensions: interview stage, call engagement, profile completeness, and application quality. The recruiter knows where to focus energy without reading through every detail.',
    beats: async ({ page, at, D, ready }) => {
      const url = candidateId ? candidateUrl(candidateId) : `${BASE}/candidates`;
      await page.goto(url, { waitUntil: 'networkidle' });
      await page.getByText('Priya').first().waitFor({ timeout: 20000 });
      const waitUntil = await ready(1000);

      // Click AI Insights tab
      const aiTab = page.getByRole('tab', { name: /ai insights/i }).first();
      await aiTab.waitFor({ timeout: 10000 }).catch(() => {});
      await clickLocator(page, aiTab, { dur: 600 });
      await page.waitForTimeout(800);

      const cap = await caption(page, 'AI Candidate Score — generated automatically');
      await waitUntil(at('scores her', 3, -0.3));

      // Ring the score number
      const scoreEl = page.getByText('61').first();
      const rScore = await ring(page, scoreEl, { label: '61 / 100 — Promising' }).catch(() => null);
      await waitUntil(at('four dimensions', 8, -0.2));
      if (rScore) await removeAnn(page, rScore);

      // Zoom to the breakdown bars
      const breakdownEl = page.getByText(/interview stage/i).first();
      await zoomTo(page, breakdownEl, 1.3, 900).catch(() => {});
      await waitUntil(at('application quality', 12, -0.2));
      await zoomReset(page);

      await removeCaption(page, cap);
      await waitUntil(D);
    },
  },

  // ── S3: AI voice screening (Bolna) ──────────────────────────────────────────
  {
    name: 's3-screen',
    account: ACCT.admin,
    narration: 'Rather than finding a time to call, the recruiter triggers an AI voice screen. Bolna dials Priya automatically and runs a structured conversation — notice period, expected CTC, interest level, and availability. While the call runs in the background, the recruiter works the rest of the pipeline. No scheduling, no small talk, no blocked calendar slots.',
    beats: async ({ page, at, D, ready }) => {
      const url = candidateId ? candidateUrl(candidateId) : `${BASE}/candidates`;
      await page.goto(url, { waitUntil: 'networkidle' });
      await page.getByText('Priya').first().waitFor({ timeout: 20000 });
      const waitUntil = await ready(800);

      // Ensure AI Insights tab is active
      const aiTab = page.getByRole('tab', { name: /ai insights/i }).first();
      await aiTab.waitFor({ timeout: 8000 }).catch(() => {});
      await clickLocator(page, aiTab, { dur: 500 });
      await page.waitForTimeout(600);

      const cap = await caption(page, 'AI Voice Screening via Bolna');
      await waitUntil(at('AI voice screen', 5, -0.3));

      const screenBtn = page.getByRole('button', { name: /ai screen/i }).first();
      const rBtn = await ring(page, screenBtn, { label: 'AI Screen button' }).catch(() => null);
      await waitUntil(at('Bolna dials', 7, -0.2));
      if (rBtn) await removeAnn(page, rBtn);
      await clickLocator(page, screenBtn, { dur: 700 }).catch(() => {});

      await waitUntil(at('background', 14, -0.2));
      const cap2 = await caption(page, 'Call running — recruiter stays productive');
      await waitUntil(at('calendar slots', D - 1.5));
      await removeCaption(page, cap2);
      await removeCaption(page, cap);
      await waitUntil(D);
    },
  },

  // ── S4: Conversion gap — narration over candidates list ─────────────────────
  {
    name: 's4-gap',
    account: ACCT.admin,
    narration: 'Here is where most pipelines leak. Shortlisting is easy. But getting a candidate to actually join — through counter-offers, cold feet, long notice periods, and radio silence — is where you lose them. The difference is coordinated, consistent follow-through at every stage.',
    beats: async ({ page, at, D, ready }) => {
      await page.goto(`${BASE}/candidates`, { waitUntil: 'networkidle' });
      await page.getByText(/candidate/i).first().waitFor({ timeout: 20000 });
      const waitUntil = await ready(800);

      const cap = await caption(page, 'The Conversion Gap: Shortlist → Joining');
      await waitUntil(at('pipelines leak', 4, -0.3));

      // Highlight the pipeline / stage column to illustrate drop-off
      const stageHeader = page.getByText(/stage/i).first();
      const rStage = await ring(page, stageHeader, { label: 'Drop-off zone' }).catch(() => null);
      await waitUntil(at('radio silence', 9, -0.2));
      if (rStage) await removeAnn(page, rStage);

      await removeCaption(page, cap);
      const cap2 = await caption(page, 'Fix: coordinated follow-through at every stage');
      await waitUntil(at('every stage', D - 1.0));
      await removeCaption(page, cap2);
      await waitUntil(D);
    },
  },

  // ── S5: Coordinated follow-up — call analysis + WhatsApp + Email ─────────────
  {
    name: 's5-followup',
    account: ACCT.admin,
    narration: 'When Priya\'s call analysis comes in, the recruiter sees the full transcript, the AI summary, and a quality score. Interest level: high. Expected CTC: twelve lakhs. Notice period: thirty days. Next step: send offer letter. The AI has done the first round entirely. Now the recruiter keeps the relationship warm. A WhatsApp message goes out right from this screen confirming her details. A formal offer email follows immediately. If she calls back, one tap connects via Exotel and logs the conversation automatically. Every touchpoint is timestamped, every response captured. Nothing falls through the cracks.',
    beats: async ({ page, at, D, ready }) => {
      const url = candidateId ? candidateUrl(candidateId) : `${BASE}/candidates`;
      await page.goto(url, { waitUntil: 'networkidle' });
      await page.getByText('Priya').first().waitFor({ timeout: 20000 });
      const waitUntil = await ready(800);

      // Switch to Call History tab
      const callTab = page.getByRole('tab', { name: /call history/i }).first();
      await callTab.waitFor({ timeout: 8000 }).catch(() => {});
      await clickLocator(page, callTab, { dur: 500 });
      await page.waitForTimeout(800);

      const cap = await caption(page, 'Call Analysis — AI-extracted insights');
      await waitUntil(at('call analysis comes in', 4, -0.3));

      // Ring the call analysis area / brain button
      const analyzeBtn = page.getByRole('button', { name: /analy/i }).first();
      await clickLocator(page, analyzeBtn, { dur: 600 }).catch(() => {});
      await page.waitForTimeout(1000);

      const interestEl = page.getByText(/interest level/i).first();
      const rInterest = await ring(page, interestEl, { label: 'Interest: High' }).catch(() => null);
      await waitUntil(at('send offer letter', 12, -0.2));
      if (rInterest) await removeAnn(page, rInterest);
      await removeCaption(page, cap);

      // WhatsApp button
      await waitUntil(at('WhatsApp message', 17, -0.3));
      const waBtn = page.getByRole('button', { name: /whatsapp/i }).first()
        .or(page.locator('[aria-label*="whatsapp" i]').first());
      const rWa = await ring(page, waBtn, { label: 'WhatsApp follow-up' }).catch(() => null);
      await clickLocator(page, waBtn, { dur: 700 }).catch(() => {});
      await page.waitForTimeout(1200);
      // Close dialog if it opened
      await page.keyboard.press('Escape').catch(() => {});
      if (rWa) await removeAnn(page, rWa);

      // Email button
      await waitUntil(at('offer email', 22, -0.3));
      const emailBtn = page.getByRole('button', { name: /email/i }).first()
        .or(page.locator('[aria-label*="email" i]').first());
      const rEmail = await ring(page, emailBtn, { label: 'Offer email' }).catch(() => null);
      await clickLocator(page, emailBtn, { dur: 700 }).catch(() => {});
      await page.waitForTimeout(1200);
      await page.keyboard.press('Escape').catch(() => {});
      if (rEmail) await removeAnn(page, rEmail);

      // Call button
      await waitUntil(at('one tap connects', 28, -0.3));
      const callBtn = page.getByRole('button', { name: /^call$/i }).first()
        .or(page.locator('[aria-label*="call" i]').first());
      const rCall = await ring(page, callBtn, { label: 'Exotel click-to-call' }).catch(() => null);
      await waitUntil(at('cracks', D - 1.5));
      if (rCall) await removeAnn(page, rCall);

      await waitUntil(D);
    },
  },

  // ── S6: Stage update ────────────────────────────────────────────────────────
  {
    name: 's6-stage',
    account: ACCT.admin,
    narration: 'As Priya moves through the process, her stage updates in one click. Screening to interview, interview to offer, offer to selected. Every stage change timestamps itself. The entire team sees exactly where she stands, in real time.',
    beats: async ({ page, at, D, ready }) => {
      const url = candidateId ? candidateUrl(candidateId) : `${BASE}/candidates`;
      await page.goto(url, { waitUntil: 'networkidle' });
      await page.getByText('Priya').first().waitFor({ timeout: 20000 });
      const waitUntil = await ready(900);

      // Overview tab
      const overviewTab = page.getByRole('tab', { name: /overview/i }).first();
      await overviewTab.waitFor({ timeout: 8000 }).catch(() => {});
      await clickLocator(page, overviewTab, { dur: 500 });
      await page.waitForTimeout(700);

      const cap = await caption(page, 'Interview Stage — one-click updates');
      await waitUntil(at('one click', 5, -0.3));

      // Ring the interview stage field / dropdown
      const stageEl = page.getByText(/selected/i).first()
        .or(page.getByText(/interview stage/i).first());
      const rStage = await ring(page, stageEl, { label: 'Current Stage: Selected' }).catch(() => null);
      await waitUntil(at('timestamps itself', 9, -0.2));
      if (rStage) await removeAnn(page, rStage);

      await removeCaption(page, cap);
      const cap2 = await caption(page, 'Full team visibility — real-time stage tracking');
      await waitUntil(at('real time', D - 1.0));
      await removeCaption(page, cap2);
      await waitUntil(D);
    },
  },

  // ── S7: HR Onboarding ───────────────────────────────────────────────────────
  {
    name: 's7-onboard',
    account: ACCT.admin,
    narration: 'Once Priya accepts the offer, HR sends her the onboarding link in one tap. She fills in her personal details, uploads her PAN card, Aadhaar, and bank documents directly. No email attachments, no chasing. The AI reviews each document automatically — checking PAN format, Aadhaar details, IFSC code — and flags any risk before HR opens the file. The HR team reviews the AI findings and approves with a single click. Priya\'s status moves to onboarded. The candidate record is complete.',
    beats: async ({ page, at, D, ready }) => {
      await page.goto(`${BASE}/hr-onboarding`, { waitUntil: 'networkidle' });
      await page.getByText(/onboarding/i).first().waitFor({ timeout: 20000 });
      const waitUntil = await ready(1000);

      const cap = await caption(page, 'HR Onboarding — paperless, AI-reviewed');
      await waitUntil(at('onboarding link', 5, -0.3));

      // Ring the "Copy Link" / share area
      const linkBtn = page.getByRole('button', { name: /copy link/i }).first()
        .or(page.getByText(/link/i).first());
      const rLink = await ring(page, linkBtn, { label: 'Share onboarding link' }).catch(() => null);
      await waitUntil(at('personal details', 9, -0.2));
      if (rLink) await removeAnn(page, rLink);

      // Navigate to public form to show candidate-side
      await waitUntil(at('PAN card', 11, -0.3));
      const joinUrlStr = formSlug ? joinUrl(formSlug) : `${BASE}/join/demo`;
      await page.goto(joinUrlStr, { waitUntil: 'networkidle' });
      await page.getByText(/personal/i).first().waitFor({ timeout: 15000 }).catch(() => {});
      await removeCaption(page, cap);
      const cap2 = await caption(page, 'Candidate fills form on mobile or browser');
      await page.waitForTimeout(500);

      // Highlight document upload section
      await waitUntil(at('bank documents', 14, -0.3));
      const docSection = page.getByText(/pan/i).first().or(page.getByText(/document/i).first());
      const rDoc = await ring(page, docSection, { label: 'Document upload' }).catch(() => null);
      await waitUntil(at('risk before HR', 18, -0.2));
      if (rDoc) await removeAnn(page, rDoc);
      await removeCaption(page, cap2);

      // Back to HR admin to show review + approve
      await page.goto(`${BASE}/hr-onboarding`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(600);
      const cap3 = await caption(page, 'AI risk review + HR approval');
      await waitUntil(at('AI findings', 22, -0.3));

      // Click on Priya's submission row
      const priyaRow = page.getByText('Priya Sharma').first();
      const rRow = await ring(page, priyaRow, { label: 'Priya Sharma — Under Review' }).catch(() => null);
      await clickLocator(page, priyaRow, { dur: 600 }).catch(() => {});
      await page.waitForTimeout(800);
      if (rRow) await removeAnn(page, rRow);

      // Highlight approve button
      const approveBtn = page.getByRole('button', { name: /approve/i }).first();
      const rApprove = await ring(page, approveBtn, { label: 'Approve with one click' }).catch(() => null);
      await waitUntil(at('single click', 26, -0.3));
      if (rApprove) await removeAnn(page, rApprove);

      await removeCaption(page, cap3);
      const cap4 = await caption(page, 'Status: Onboarded — record complete');
      await waitUntil(at('candidate record is complete', D - 1.5));
      await removeCaption(page, cap4);
      await waitUntil(D);
    },
  },

  // ── S8: Close — back to dashboard ───────────────────────────────────────────
  {
    name: 's8-close',
    account: ACCT.admin,
    narration: 'From a referral link to a verified, onboarded hire. Every step tracked, every call recorded, every document verified, every follow-up logged. No candidate lost to silence. No recruiter flying blind. This is how In-Sync ATS turns a leaky pipeline into a closed one.',
    beats: async ({ page, at, D, ready }) => {
      await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' });
      await page.getByText('Dashboard').first().waitFor({ timeout: 20000 });
      const waitUntil = await ready(1000);

      const cap = await caption(page, 'From referral link to onboarded hire — fully tracked');
      await waitUntil(at('onboarded hire', 5, -0.3));

      const statsGrid = page.locator('.grid').first();
      await zoomTo(page, statsGrid, 1.2, 900).catch(() => {});
      await waitUntil(at('No recruiter', 11, -0.2));
      await zoomReset(page);

      await removeCaption(page, cap);
      const cap2 = await caption(page, 'In-Sync ATS — insync.ai');
      await waitUntil(at('closed one', D - 1.5));
      await removeCaption(page, cap2);
      await waitUntil(D);
    },
  },
];
