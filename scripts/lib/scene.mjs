// Scene runner for ATS walkthrough: login -> record video -> trim lead -> encode.
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { loadEnv } from './env.mjs';
import * as V from './video.mjs';
import { installCursor } from './cursor.mjs';
import { login } from './app.mjs';

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'recordings', 'scenes');
const env = loadEnv(new URL('../../.env', import.meta.url));
const VP = { width: 1366, height: 768 };

export const ACCT = {
  admin: { email: env.ATS_ADMIN_EMAIL, password: env.ATS_ADMIN_PASSWORD },
  guest: { guest: true },
};

// Continuous-narration mode: record VIDEO ONLY, paced to a slot of the single
// master audio track. `localFind(phrase)` returns the GLOBAL time of a word
// within this scene's character range (scoped to avoid cross-scene word collisions).
export async function recordSceneVideo({ scene, slotStart, slotDuration, localFind, tailT = 0.5 }) {
  const browser = await chromium.launch({ headless: true });
  let storageState;
  if (!scene.account.guest) {
    const a = await browser.newContext({ viewport: VP });
    const ap = await a.newPage();
    await login(ap, scene.account.email, scene.account.password);
    storageState = await a.storageState();
    await a.close();
  }
  const ctx = await browser.newContext({
    viewport: VP,
    storageState,
    timezoneId: 'Asia/Kolkata',
    locale: 'en-IN',
    recordVideo: { dir: outDir, size: VP },
  });
  const page = await ctx.newPage();
  let leadSec = 0, tBeats = 0;
  const t0 = Date.now();
  const ready = async (extra = 300) => {
    await page.waitForTimeout(extra);
    leadSec = (Date.now() - t0) / 1000;
    await installCursor(page);
    tBeats = Date.now();
    return async (s) => { const e = (Date.now() - tBeats) / 1000; if (e < s) await page.waitForTimeout((s - e) * 1000); };
  };
  const at = (phrase, fb, off = 0) => {
    const g = localFind(phrase);
    const local = g == null ? fb : g - slotStart;
    return Math.max(0, local) + off;
  };
  const D = slotDuration + tailT;
  try { await scene.beats({ page, find: localFind, at, D, ready }); }
  catch (e) { console.log(`[${scene.name}] beats error: ${e.message.split('\n')[0]}`); }
  await ctx.close();
  await browser.close();

  const webm = await page.video().path();
  const mp4 = join(outDir, `${scene.name}-v.mp4`);
  V.webmToMp4(webm, mp4, leadSec, D);
  console.log(`[${scene.name}] video ${D.toFixed(2)}s (lead ${leadSec.toFixed(2)})`);
  return mp4;
}
