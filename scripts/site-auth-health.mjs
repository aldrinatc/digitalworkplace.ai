import { setTimeout as sleep } from 'node:timers/promises';

const site = (id, url, title, extra = {}) => ({ id, url, kind: 'page', title, ...extra });
const privateApi = (id, url) => ['anonymous', 'invalid-token'].map(mode => ({ id: `${id}-${mode}`, url, kind: 'private-api', mode }));

// These are read-only probes. No account credentials or user cookies are used.
export const probes = [
  site('main-sign-in', 'https://www.digitalworkplace.ai/sign-in', 'Digital Workplace AI'),
  site('support-page', 'https://dsq.digitalworkplace.ai/dsq/demo/cor', 'dSQ | Support Portal'),
  site('intranet-page', 'https://diq.digitalworkplace.ai/diq/dashboard', 'dIQ - Intranet IQ'),
  site('chat-core-page', 'https://dcq.digitalworkplace.ai/dcq/Home/index.html', 'dCQ Chatbot | Chat Core IQ'),
  site('test-pilot-page', 'https://dtq.digitalworkplace.ai/dtq/dashboard', 'dTQ - Testing IQ'),
  site('grc-page', 'https://auctorgrc.vercel.app', 'Auctor', { titleIncludes: true, demoCookie: 'auctor_session' }),
  { id: 'clerk-public-keys', url: 'https://clerk.digitalworkplace.ai/.well-known/jwks.json', kind: 'jwks' },
  ...['dashboard', 'admin'].map(path => ({ id: `main-${path}-anonymous`, url: `https://www.digitalworkplace.ai/${path}`, kind: 'clerk-protection' })),
  ...privateApi('support-drafts', 'https://dsq.digitalworkplace.ai/dsq/api/drafts'),
  ...privateApi('intranet-admin-stats', 'https://diq.digitalworkplace.ai/diq/api/admin/stats'),
  { id: 'intranet-admin-stats-forged-origin', url: 'https://diq.digitalworkplace.ai/diq/api/admin/stats', kind: 'private-api', mode: 'forged-origin' },
  ...privateApi('chat-core-access', 'https://dcq.digitalworkplace.ai/dcq/api/admin/access'),
  ...privateApi('chat-core-documents', 'https://dcq.digitalworkplace.ai/dcq/api/documents'),
  ...privateApi('chat-core-logs', 'https://dcq.digitalworkplace.ai/dcq/api/log'),
  ...privateApi('chat-core-analytics', 'https://dcq.digitalworkplace.ai/dcq/api/analytics'),
];

class CheckFailure extends Error {}

async function request(probe, fetcher, signal) {
  const origin = new URL(probe.url).origin;
  let url = probe.url;
  let demoCookie;
  for (let redirects = 0; redirects <= 5; redirects++) {
    const headers = { 'User-Agent': 'DigitalWorkplace-Availability-Check/1.0' };
    if (probe.mode === 'invalid-token') headers.Authorization = 'Bearer invalid.auth-check.token';
    if (probe.mode === 'forged-origin') {
      headers.Origin = 'https://intranet-iq.vercel.app';
      headers.Referer = 'https://intranet-iq.vercel.app/diq/admin';
    }
    if (demoCookie) headers.Cookie = demoCookie;
    const response = await fetcher(url, { headers, redirect: 'manual', signal });
    if (![301, 302, 303, 307, 308].includes(response.status)) return response;
    const location = response.headers.get('location');
    if (!location) throw new CheckFailure('redirect-without-location');
    const next = new URL(location, url);
    // Never forward a demo cookie or an Authorization header to another origin.
    if (next.origin !== origin) throw new CheckFailure('cross-origin-redirect');
    if (probe.demoCookie) {
      for (const cookie of response.headers.getSetCookie()) {
        const pair = cookie.split(';', 1)[0];
        if (pair.startsWith(`${probe.demoCookie}=`)) demoCookie = pair;
      }
    }
    await response.body?.cancel();
    url = next.href;
  }
  throw new CheckFailure('redirect-limit');
}

async function validate(probe, response) {
  if (probe.kind === 'clerk-protection') {
    if (response.status !== 404 || response.headers.get('x-clerk-auth-status') !== 'signed-out' || !response.headers.get('x-clerk-auth-reason')?.includes('protect-rewrite')) {
      throw new CheckFailure('main-protection-not-confirmed');
    }
    return;
  }
  if (probe.kind === 'private-api') {
    if (response.status !== 401) throw new CheckFailure('unauthenticated-request-not-rejected');
    if (!response.headers.get('content-type')?.includes('application/json')) throw new CheckFailure('expected-json-auth-rejection');
    const json = await response.json();
    if (typeof json.error !== 'string' || !json.error) throw new CheckFailure('expected-json-auth-rejection');
    return;
  }
  if (response.status !== 200) throw new CheckFailure('unexpected-http-status');
  if (probe.kind === 'jwks') {
    const json = await response.json();
    if (!json.keys?.some(key => key.kty === 'RSA' && key.kid && key.n && key.e)) throw new CheckFailure('public-signing-key-unavailable');
    return;
  }
  if (!response.headers.get('content-type')?.includes('text/html')) throw new CheckFailure('expected-html-page');
  const html = await response.text();
  const title = html.match(/<title>([^<]*)<\/title>/i)?.[1] || '';
  const matches = probe.titleIncludes ? title.toLowerCase().includes(probe.title.toLowerCase()) : title === probe.title;
  if (!matches || /application error|internal server error/i.test(title)) throw new CheckFailure('unexpected-page-title');
}

export async function runProbe(probe, { fetcher = fetch, pause = sleep, timeoutMs = 20000 } = {}) {
  let result;
  for (let attempt = 1; attempt <= 2; attempt++) {
    let response;
    try {
      response = await request(probe, fetcher, AbortSignal.timeout(timeoutMs));
      await validate(probe, response);
      return { check: probe.id, status: 'passed', http: response.status, attempts: attempt };
    } catch (error) {
      // Do not log URLs, response bodies, cookies, tokens, or arbitrary exception text.
      result = { check: probe.id, status: 'failed', ...(response && { http: response.status }), attempts: attempt, reason: error instanceof CheckFailure ? error.message : 'request-or-response-failed' };
    } finally {
      if (response?.body && !response.bodyUsed) await response.body.cancel().catch(() => {});
    }
    if (attempt === 1) await pause(1000);
  }
  return result;
}

export async function runChecks(checks = probes, options = {}) {
  const results = new Array(checks.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(4, checks.length) }, async () => {
    while (next < checks.length) {
      const index = next++;
      results[index] = await runProbe(checks[index], options);
    }
  }));
  return results;
}
