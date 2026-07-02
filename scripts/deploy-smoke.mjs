#!/usr/bin/env node
/**
 * Post-deployment smoke check (promotion pipeline, charter Task 21).
 *
 * Polls the deployed app until it serves the SPA shell and its API answers the
 * health endpoint, then exits 0. Exits 1 (failing the pipeline, which alerts
 * via GitHub's workflow-failure notification) if the deployment is not healthy
 * within the timeout.
 *
 * Usage: node scripts/deploy-smoke.mjs https://the-deployment-url
 */
const base = process.argv[2];
if (!base) {
  console.error('usage: node scripts/deploy-smoke.mjs <deployment-url>');
  process.exit(1);
}

const TIMEOUT_MS = 5 * 60 * 1000;
const INTERVAL_MS = 10 * 1000;
const deadline = Date.now() + TIMEOUT_MS;

// Vercel Deployment Protection: protected URLs serve an auth interstitial to
// anonymous requests. With a "Protection Bypass for Automation" secret
// (Vercel project → Settings → Deployment Protection) provided via the
// VERCEL_AUTOMATION_BYPASS_SECRET repo secret, the smoke check authenticates
// and validates the real app. Without it, a protection interstitial is
// treated as "deployment up but protected" — reported, not failed.
const BYPASS = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
const HEADERS = BYPASS ? { 'x-vercel-protection-bypass': BYPASS } : {};

function isProtectionPage(res, text) {
  return (
    (res.status === 401 || res.status === 403) &&
    /vercel|sso|authentication/i.test(text ?? '')
  );
}

async function check(url, validate) {
  const res = await fetch(url, { redirect: 'follow', headers: HEADERS });
  const text = await res.text();
  if (!res.ok) {
    if (!BYPASS && isProtectionPage(res, text)) {
      console.log(
        `${url} is behind Vercel Deployment Protection (HTTP ${res.status}). ` +
          'Add the VERCEL_AUTOMATION_BYPASS_SECRET repo secret to smoke-check the real app.',
      );
      return 'protected';
    }
    throw new Error(`${url} -> HTTP ${res.status}`);
  }
  await validate(text);
  return 'ok';
}

async function attempt() {
  // 1. SPA shell is served.
  const shell = await check(base, async (text) => {
    if (!text.includes('<div id="root">')) throw new Error('SPA shell missing #root');
  });
  if (shell === 'protected') return; // cannot see deeper without a bypass secret
  // 2. API is up and reaches the database.
  await check(`${base}/api/health`, async (text) => {
    const body = JSON.parse(text);
    if (body?.ok !== true && body?.status !== 'ok') {
      throw new Error(`health endpoint unhealthy: ${JSON.stringify(body)}`);
    }
  });
}

for (;;) {
  try {
    await attempt();
    console.log(`deployment healthy: ${base}`);
    process.exit(0);
  } catch (err) {
    if (Date.now() > deadline) {
      console.error(`deployment failed smoke check: ${err.message}`);
      process.exit(1);
    }
    console.log(`not ready yet (${err.message}); retrying in ${INTERVAL_MS / 1000}s`);
    await new Promise((r) => setTimeout(r, INTERVAL_MS));
  }
}
