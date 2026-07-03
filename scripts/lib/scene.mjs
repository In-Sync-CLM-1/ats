// Scene runner for ATS walkthrough: login -> record video -> trim lead -> encode.
import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { loadEnv } from './env.mjs';
import * as V from './video.mjs';
import { installCursor } from './cursor.mjs';
import { login } from './app.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, '..', 'recordings', 'scenes');
const env = loadEnv(new URL('../../.env', import.meta.url));
const VP = { width: 1366, height: 768 };
// White-label logo (TechCorp) injected into the app sidebar at record time.
const SIDEBAR_LOGO = 'data:image/png;base64,' +
  readFileSync(join(here, '..', '..', 'src', 'assets', 'techcorp-logo-white.png')).toString('base64');

export const ACCT = {
  admin:     { email: env.ATS_ORG_ADMIN_EMAIL,    password: env.ATS_ORG_ADMIN_PASSWORD },
  recruiter: { email: env.ATS_RECRUITER_EMAIL,    password: env.ATS_RECRUITER_PASSWORD },
  guest:     { guest: true },
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
  // Video-only sidebar treatment (no app change): white-label the logo (TechCorp),
  // shrink it, hide the "Need help?" card, and COMPACT the nav so all ~19 items fit
  // (fixes "menu looks zoomed, options not visible"). The <style> must land in <head>.
  await ctx.addInitScript((logoSrc) => {
    const CSS = `
      [data-sidebar="header"]{padding:6px 8px!important}
      [data-sidebar="header"] > div{padding:6px!important;background:transparent!important;backdrop-filter:none!important}
      [data-sidebar="header"] img[alt="Logo"]{width:74%!important;height:auto!important;filter:none!important}
      [data-sidebar="footer"]{padding:6px!important}
      [data-sidebar="footer"] > div:first-child{display:none!important}
      [data-sidebar="group"]{padding-top:2px!important;padding-bottom:2px!important}
      [data-sidebar="group-label"]{height:20px!important;font-size:10px!important;margin:2px 0!important}
      [data-sidebar="menu-button"],[data-sidebar="menu"] a,[data-sidebar="menu"] button{
        padding-top:5px!important;padding-bottom:5px!important;min-height:0!important;height:auto!important;font-size:13px!important}
      [data-sidebar="menu-item"]{margin:1px 0!important}
      [data-sidebar="content"]{gap:2px!important;overflow:hidden!important}
    `;
    const style = () => {
      if (document.getElementById('__sbfix')) return true;
      if (!document.head) return false;
      const s = document.createElement('style'); s.id = '__sbfix'; s.textContent = CSS;
      document.head.appendChild(s); return true;
    };
    const swapLogo = () => {
      const img = document.querySelector('img[alt="Logo"]');
      if (img && img.src !== logoSrc) { img.src = logoSrc; }
    };
    const run = () => { style(); swapLogo(); };
    run();
    const iv = setInterval(run, 60);
    setTimeout(() => clearInterval(iv), 6000);
    document.addEventListener('DOMContentLoaded', run);
  }, SIDEBAR_LOGO);
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
