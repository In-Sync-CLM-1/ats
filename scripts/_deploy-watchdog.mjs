// Deploy + smoke-test the ghosting-watchdog edge function.
// Handles CRON_SECRET generation, Supabase secret sync, function deploy
// (management API multipart), and a live invocation.
import { readFileSync, writeFileSync, appendFileSync } from 'fs';
import { randomBytes } from 'crypto';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { loadEnv } from './lib/env.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const envPath = join(here, '..', '.env');
let env = loadEnv(new URL('../.env', import.meta.url));
const REF = 'htdwkhtfdifwajdkkpul';
const MGMT = `https://api.supabase.com/v1/projects/${REF}`;
const H = { Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}`, 'User-Agent': 'curl/8' };

// 1. CRON_SECRET — generate once, persist to .env
if (!env.CRON_SECRET) {
  const secret = randomBytes(24).toString('hex');
  appendFileSync(envPath, `\nCRON_SECRET=${secret}\n`);
  env = loadEnv(new URL('../.env', import.meta.url));
  console.log('CRON_SECRET generated and stored in .env');
} else {
  console.log('CRON_SECRET already present');
}

// 2. Sync the secret to Supabase function env
const sec = await fetch(`${MGMT}/secrets`, {
  method: 'POST',
  headers: { ...H, 'Content-Type': 'application/json' },
  body: JSON.stringify([{ name: 'CRON_SECRET', value: env.CRON_SECRET }]),
});
console.log('secret sync:', sec.status, sec.ok ? 'ok' : await sec.text());

// 3. Deploy the function (multipart: metadata + file)
const code = readFileSync(join(here, '..', 'supabase', 'functions', 'ghosting-watchdog', 'index.ts'), 'utf8');
const form = new FormData();
form.append('metadata', JSON.stringify({
  name: 'ghosting-watchdog',
  entrypoint_path: 'index.ts',
  verify_jwt: false,
}));
form.append('file', new Blob([code], { type: 'application/typescript' }), 'index.ts');
const dep = await fetch(`${MGMT}/functions/deploy?slug=ghosting-watchdog`, { method: 'POST', headers: H, body: form });
const depBody = await dep.text();
console.log('deploy:', dep.status, dep.ok ? JSON.parse(depBody).status : depBody);

// 4. Smoke test — invoke with the cron secret
await new Promise((r) => setTimeout(r, 4000));
const run = await fetch(`https://${REF}.supabase.co/functions/v1/ghosting-watchdog`, {
  method: 'POST',
  headers: { 'x-cron-secret': env.CRON_SECRET, 'Content-Type': 'application/json' },
  body: '{}',
});
console.log('invoke:', run.status, await run.text());
