// Hourly trigger for the ats ghosting-watchdog edge function.
// One scheduled task per Worker (house pattern). CRON_SECRET is a Worker secret.
export default {
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(
      fetch(env.FUNCTION_URL, {
        method: "POST",
        headers: {
          "x-cron-secret": env.CRON_SECRET,
          "Content-Type": "application/json",
        },
        body: "{}",
      }).then(async (r) => {
        const body = await r.text();
        if (!r.ok) throw new Error(`watchdog ${r.status}: ${body}`);
        console.log(`watchdog ok: ${body}`);
      }),
    );
  },
};
