// ATS walkthrough render — continuous-narration pipeline.
// ONE Riya take for the whole script; video recorded to per-scene slots;
// crossfaded; narration laid underneath as one track.
//
//   node scripts/render-continuous.mjs              # seed + synth + record + stitch
//   SKIP_SEED=1 node scripts/render-continuous.mjs  # re-record against existing data
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { execFileSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { SCENES } from './scenes.mjs';
import { recordSceneVideo } from './lib/scene.mjs';
import { synthTimed } from './lib/voice.mjs';
import { crossfadeStitchVideo, overlayAudio, holdAndFade } from './lib/video.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const dir = join(here, 'recordings', 'scenes');
const T_X = 0.5;

// 0. Seed live demo state before recording
if (process.env.SKIP_SEED !== '1') {
  console.log('Seeding ATS demo state...');
  execFileSync(process.execPath, [join(here, 'seed-ats.mjs')], { stdio: 'inherit' });
}

// 1. Synthesize one continuous narration (cached so re-runs are deterministic & resumable)
const SEP = ' ';
const fullText = SCENES.map((s) => s.narration).join(SEP);
const mp3Path = join(dir, 'full-narration.mp3');
const alignPath = join(dir, 'narration-align.json');
let Taud;
if (process.env.FRESH_NARRATION !== '1' && existsSync(mp3Path) && existsSync(alignPath)) {
  const c = JSON.parse(readFileSync(alignPath, 'utf8'));
  if (c.text === fullText) {
    console.log('Reusing cached narration + alignment.');
    const starts = c.starts;
    Taud = {
      duration: c.duration, joined: c.joined, starts, ends: c.ends,
      timeAtChar: (i) => starts[Math.max(0, Math.min(i, starts.length - 1))],
    };
  }
}
if (!Taud) {
  console.log('\nSynthesizing full narration (0.95x speed)...');
  Taud = await synthTimed(fullText, mp3Path, { speed: 0.95 });
  writeFileSync(alignPath, JSON.stringify({
    text: fullText, duration: Taud.duration, joined: Taud.joined, starts: Taud.starts, ends: Taud.ends,
  }));
}
console.log(`Narration: ${Taud.duration.toFixed(1)}s across ${SCENES.length} scenes`);

// 2. Carve slots + build scene-local word finders
let offset = 0;
const slots = SCENES.map((s, i) => {
  const charStart = offset, charEnd = offset + s.narration.length;
  const nextOffset = offset + s.narration.length + SEP.length;
  const start = Taud.timeAtChar(charStart);
  const end = i < SCENES.length - 1 ? Taud.timeAtChar(nextOffset) : Taud.duration;
  offset = nextOffset;
  // Scope word finder to THIS scene's char range — prevents cross-scene word collisions
  const localFind = (phrase) => {
    const k = Taud.joined.indexOf(phrase.toLowerCase(), charStart);
    return (k < 0 || k >= charEnd) ? null : Taud.starts[k];
  };
  return { start, duration: end - start, localFind };
});

// 3. Record each scene (resilient to transient network drops: many retries + backoff
//    that waits for connectivity to return before re-attempting the scene).
const waitForNet = async () => {
  for (let i = 0; i < 30; i++) {
    try {
      const r = await fetch('https://ats-6t2.pages.dev/auth', { method: 'HEAD' });
      if (r.ok || r.status < 500) return true;
    } catch {}
    await new Promise((res) => setTimeout(res, 5000));
  }
  return false;
};
const videos = [];
for (let i = 0; i < SCENES.length; i++) {
  const sc = SCENES[i];
  // Resume: reuse an already-recorded clip if its duration matches this slot.
  const cachedMp4 = join(dir, `${sc.name}-v.mp4`);
  const expectedD = slots[i].duration + T_X;
  if (process.env.FRESH_VIDEO !== '1' && existsSync(cachedMp4)) {
    try {
      const dur = parseFloat(execFileSync('ffprobe',
        ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', cachedMp4]).toString().trim());
      if (isFinite(dur) && Math.abs(dur - expectedD) < 0.4) {
        console.log(`[${sc.name}] reuse cached clip (${dur.toFixed(2)}s)`);
        videos.push(cachedMp4);
        continue;
      }
    } catch { /* re-record */ }
  }
  let v, lastErr;
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      v = await recordSceneVideo({
        scene: sc,
        slotStart: slots[i].start,
        slotDuration: slots[i].duration,
        localFind: slots[i].localFind,
        tailT: T_X,
      });
      break;
    } catch (e) {
      lastErr = e;
      console.log(`[${sc.name}] attempt ${attempt + 1} failed: ${e.message.split('\n')[0]}`);
      if (/ERR_INTERNET_DISCONNECTED|ERR_NETWORK|ERR_NAME_NOT_RESOLVED|ETIMEDOUT|ENOTFOUND/.test(e.message)) {
        console.log(`[${sc.name}] network drop — waiting for connectivity...`);
        await waitForNet();
      }
      await new Promise((res) => setTimeout(res, 3000));
    }
  }
  if (!v) throw new Error(`Scene ${sc.name} failed after retries: ${lastErr?.message}`);
  videos.push(v);
}

// 4. Stitch videos, overlay narration, fade to black
console.log('\nStitching + overlaying narration...');
const silent = join(dir, 'ats-silent.mp4');
crossfadeStitchVideo(videos, silent, T_X);
const narrated = join(dir, 'ats-narrated.mp4');
overlayAudio(silent, join(dir, 'full-narration.mp3'), narrated);
const out = 'C:\\Users\\Admin\\Downloads\\ats-demo-full.mp4';
holdAndFade(narrated, out, 2.0, 1.2);
console.log('DONE ->', out);
