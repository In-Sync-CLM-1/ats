// Canonical ATS promo narration + timing generator.
//   node scripts/gen-promo-timings.mjs      (FRESH_NARRATION=1 forces re-synth)
// Synthesizes the single continuous ElevenLabs take (cache-aware), then writes
// remotion-promo/src/timings.ts with per-scene durations AND phrase-level marks
// so on-screen text lands exactly when the voice says it.
// Story is feature-led from the website product page (mandates/SLA, AI-scored
// intake, Aadhaar/PAN verification, built-in calling, recruiter analytics).
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { synthTimed } from './lib/voice.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const dir = join(here, 'recordings', 'scenes');

export const NARR = {
  n0: "Candidates sourced — but where does each one stand? Eight hundred candidates across three spreadsheets. In-Sync ATS puts your whole pipeline on one live screen.",
  n1: "One system runs it end to end: mandates with deadlines, a public careers page, a live pipeline, bulk résumé import, KYC onboarding, built-in calling, and recruiter analytics.",
  n2a: "One — every role has a deadline. Positions, priority, target date — you see a mandate slipping before the client calls.",
  n2b: "Two — candidates arrive scored. They apply on your careers page or land in a bulk import — parsed, de-duplicated, scored by the A.I. into a ranked list.",
  n2c: "Three — verified before placed. Aadhaar and PAN checks in the flow, audit-ready — and candidate data protected under the D.P.D.P. Act.",
  n2e: "Four — the joining is guarded. Between the offer and day one, the A.I. calls the reminders — a quiet candidate is caught, and the yes comes back in writing.",
  n2d: "And it adds up: every recruiter, every mandate, one dashboard — when the review asks how hiring is going, you just show them.",
  n3: "The result? A clean, scored database. Verified placements. Up to sixty percent faster time-to-fill.",
  n4: "In-Sync ATS. Sourcing is the easy part... We run the pipeline. Book your free demo, and know where every candidate stands.",
};
const ORDER = ['n0', 'n1', 'n2a', 'n2b', 'n2c', 'n2e', 'n2d', 'n3', 'n4'];

// scene key in the Remotion comp -> narration slot + phrases to mark
const SCENE_MAP = [
  { k: 'hook', slot: 'n0', marks: { sub: 'where does each', pct: 'Eight hundred', never: 'three spreadsheets', brand: 'In-Sync ATS puts' } },
  { k: 'sweep', slot: 'n1', marks: {
    f0: 'mandates with deadlines', f1: 'public careers page', f2: 'a live pipeline',
    f3: 'bulk résumé import', f4: 'KYC onboarding', f5: 'built-in calling', f6: 'recruiter analytics' } },
  { k: 'p1', slot: 'n2a', marks: { chip: 'Positions, priority' } },
  { k: 'p2', slot: 'n2b', marks: { chip: 'parsed' } },
  { k: 'p3', slot: 'n2c', marks: { chip: 'Aadhaar' } },
  { k: 'p4', slot: 'n2e', marks: { chip: 'calls the reminders' } },
  { k: 'adds', slot: 'n2d', marks: { chip: 'one dashboard', show: 'you just show them' } },
  { k: 'outcome', slot: 'n3', marks: { l0: 'clean', l1: 'Verified placements', l2: 'sixty percent' } },
  { k: 'cta', slot: 'n4', marks: { btn: 'Book your free demo', url: 'know where every' } },
];

const SEP = ' ';
const fullText = ORDER.map((k) => NARR[k]).join(SEP);
const mp3Path = join(dir, 'promo-narration.mp3');
const alignPath = join(dir, 'promo-align.json');

let T;
if (process.env.FRESH_NARRATION !== '1' && existsSync(mp3Path) && existsSync(alignPath)) {
  const c = JSON.parse(readFileSync(alignPath, 'utf8'));
  if (c.text === fullText) {
    console.log('Reusing cached narration.');
    T = { duration: c.duration, joined: c.joined, starts: c.starts,
      timeAtChar: (i) => c.starts[Math.max(0, Math.min(i, c.starts.length - 1))] };
  }
}
if (!T) {
  console.log(`Synthesizing narration (${fullText.length} chars, 1.1x)...`);
  T = await synthTimed(fullText, mp3Path, { speed: 1.1 });
  writeFileSync(alignPath, JSON.stringify({ text: fullText, duration: T.duration, joined: T.joined, starts: T.starts, ends: T.ends }));
}
console.log(`Narration ${T.duration.toFixed(2)}s`);

let offset = 0;
const slots = {};
for (let i = 0; i < ORDER.length; i++) {
  const k = ORDER[i];
  const cS = offset, cE = offset + NARR[k].length, nO = cE + SEP.length;
  const start = T.timeAtChar(cS);
  const end = i < ORDER.length - 1 ? T.timeAtChar(nO) : T.duration;
  offset = nO;
  slots[k] = { start, end, dur: end - start, cS, cE };
}

const FPS = 30;
const scenes = SCENE_MAP.map(({ k, slot, marks }) => {
  const s = slots[slot];
  const m = {};
  for (const [name, phrase] of Object.entries(marks)) {
    const j = T.joined.indexOf(phrase.toLowerCase(), s.cS);
    if (j < 0 || j >= s.cE) {
      console.warn(`  WARN mark "${name}" ("${phrase}") not found in slot ${slot}`);
      m[name] = 0;
    } else {
      m[name] = Math.round((T.timeAtChar(j) - s.start) * FPS); // frames, scene-relative
    }
  }
  return { k, s: +s.dur.toFixed(2), marks: m };
});

const out = `// AUTO-GENERATED by scripts/gen-promo-timings.mjs — do not edit by hand.
// Scene durations (seconds) + phrase marks (frames, scene-relative) locked to
// the narration take (${T.duration.toFixed(2)}s total).
export const FPS = ${FPS};
export const NARRATION_SECONDS = ${T.duration.toFixed(2)};
export const SCENES = ${JSON.stringify(scenes, null, 2)} as const;
export type SceneKey = typeof SCENES[number]['k'];
`;
const outPath = join(here, '..', 'remotion-promo', 'src', 'timings.ts');
writeFileSync(outPath, out);
console.log(`Wrote ${outPath}`);
for (const sc of scenes) console.log(` ${sc.k}: ${sc.s}s marks=${JSON.stringify(sc.marks)}`);
