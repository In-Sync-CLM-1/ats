// ATS app driver: login (email + password, no org select).
// Record against the Cloudflare Pages subdomain (not the apex) to avoid the
// managed-challenge that blocks headless browsers.
export const BASE = 'https://ats-6t2.pages.dev';

// Login: fill #login-email + #login-password, click Sign In, wait for /dashboard
// AND a persisted Supabase session token. Retries up to 6x (auth race condition).
export async function login(page, email, password) {
  const attempt = async () => {
    await page.goto(`${BASE}/auth`, { waitUntil: 'networkidle' });
    await page.locator('#login-email').fill(email, { timeout: 25000 });
    await page.locator('#login-password').fill(password);
    await page.getByRole('button', { name: /^sign in$/i }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 20000 });
    await page.waitForFunction(
      () => Object.keys(localStorage).some((k) => /sb-.*-auth-token/.test(k) && localStorage.getItem(k)),
      undefined, { timeout: 8000 },
    );
  };
  let err;
  for (let i = 0; i < 6; i++) {
    try { await attempt(); await page.waitForLoadState('networkidle').catch(() => {}); return; }
    catch (e) { err = e; await page.waitForTimeout(1500); }
  }
  throw err;
}

export const candidateUrl = (id) => `${BASE}/candidates/view/${id}`;
export const mandateUrl = (id) => `${BASE}/mandates/view/${id}`;
export const applyUrl = (referralCode) => `${BASE}/apply/${referralCode}`;
export const joinUrl = (slug) => `${BASE}/join/${slug}`;
