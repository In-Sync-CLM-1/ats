// Deploy the ghosting-watchdog Cloudflare Worker cron (token/secret stay in-process).
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { loadEnv } from './lib/env.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const env = loadEnv(new URL('../.env', import.meta.url));
const cwd = join(here, '..', 'cron-worker', 'ghosting-watchdog');
const wranglerEnv = {
  ...process.env,
  CLOUDFLARE_API_TOKEN: env.CLOUDFLARE_API_TOKEN,
  CLOUDFLARE_ACCOUNT_ID: env.CLOUDFLARE_ACCOUNT_ID,
};

const dep = spawnSync('npx', ['wrangler', 'deploy'], { cwd, env: wranglerEnv, shell: true, encoding: 'utf8' });
console.log(dep.stdout || '');
if (dep.status !== 0) { console.error(dep.stderr); process.exit(1); }

const sec = spawnSync('npx', ['wrangler', 'secret', 'put', 'CRON_SECRET'], {
  cwd, env: wranglerEnv, shell: true, encoding: 'utf8', input: env.CRON_SECRET,
});
console.log(sec.stdout || '');
if (sec.status !== 0) { console.error(sec.stderr); process.exit(1); }
console.log('worker deployed with hourly cron + secret set');
