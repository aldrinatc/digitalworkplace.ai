import test from 'node:test';
import assert from 'node:assert/strict';
import { probes, runProbe, runChecks } from './site-auth-health.mjs';

const page = { id: 'page', url: 'https://example.test/', kind: 'page', title: 'Working' };
const html = title => new Response(`<title>${title}</title>`, { headers: { 'content-type': 'text/html' } });
const options = fetcher => ({ fetcher, pause: async () => {} });

test('wrong page and server error are failures, even when HTTP is 200', async () => {
  for (const title of ['Missing', 'Application error: Working']) {
    const result = await runProbe(page, options(async () => html(title)));
    assert.equal(result.status, 'failed');
    assert.equal(result.attempts, 2);
  }
});

test('one retry recovers a transient outage', async () => {
  let calls = 0;
  const result = await runProbe(page, options(async () => ++calls === 1 ? new Response('', { status: 503 }) : html('Working')));
  assert.equal(result.status, 'passed');
  assert.equal(result.attempts, 2);
});

test('GRC demo cookie is kept only for this same-origin request chain', async () => {
  let calls = 0;
  const result = await runProbe({ ...page, demoCookie: 'auctor_session' }, options(async (url, init) => {
    if (++calls === 1) {
      assert.equal(init.headers.Cookie, undefined);
      return new Response(null, { status: 307, headers: { location: '/dashboard', 'set-cookie': 'auctor_session=synthetic-demo; Path=/; Secure; HttpOnly' } });
    }
    assert.equal(url, 'https://example.test/dashboard');
    assert.equal(init.headers.Cookie, 'auctor_session=synthetic-demo');
    return html('Working');
  }));
  assert.equal(result.status, 'passed');
  assert.equal(JSON.stringify(result).includes('synthetic-demo'), false);
});

test('cross-origin redirects are refused before forwarding any headers', async () => {
  const visited = [];
  const result = await runProbe({ ...page, demoCookie: 'auctor_session' }, options(async url => {
    visited.push(url);
    return new Response(null, { status: 307, headers: { location: 'https://other.test/', 'set-cookie': 'auctor_session=private' } });
  }));
  assert.equal(result.reason, 'cross-origin-redirect');
  assert.deepEqual(visited, [page.url, page.url]);
});

test('redirect loops are bounded', async () => {
  let calls = 0;
  const result = await runProbe(page, options(async () => { calls++; return new Response(null, { status: 307, headers: { location: '/' } }); }));
  assert.equal(result.reason, 'redirect-limit');
  assert.equal(calls, 12);
});

test('Clerk protection requires its denial marker; an unrelated 404 cannot pass', async () => {
  const probe = { ...page, kind: 'clerk-protection' };
  assert.equal((await runProbe(probe, options(async () => new Response(null, { status: 404 })))).status, 'failed');
  assert.equal((await runProbe(probe, options(async () => new Response(null, { status: 404, headers: { 'x-clerk-auth-status': 'signed-out', 'x-clerk-auth-reason': 'protect-rewrite, session-token-and-uat-missing' } })))).status, 'passed');
});

test('private APIs must reject both anonymous and invalid tokens as JSON 401', async () => {
  for (const mode of ['anonymous', 'invalid-token', 'forged-origin']) {
    const probe = { ...page, kind: 'private-api', mode };
    const result = await runProbe(probe, options(async (_url, init) => {
      assert.equal(init.headers.Authorization, mode === 'invalid-token' ? 'Bearer invalid.auth-check.token' : undefined);
      assert.equal(init.headers.Origin, mode === 'forged-origin' ? 'https://intranet-iq.vercel.app' : undefined);
      assert.equal(init.headers.Referer, mode === 'forged-origin' ? 'https://intranet-iq.vercel.app/diq/admin' : undefined);
      return Response.json({ error: 'Sign in' }, { status: 401 });
    }));
    assert.equal(result.status, 'passed');
    assert.equal((await runProbe(probe, options(async () => html('Working')))).status, 'failed');
    assert.equal((await runProbe(probe, options(async () => new Response('Unauthorized', { status: 401 })))).status, 'failed');
  }
});

test('public Clerk signing keys must be present', async () => {
  const probe = { ...page, kind: 'jwks' };
  assert.equal((await runProbe(probe, options(async () => Response.json({ keys: [] })))).status, 'failed');
  assert.equal((await runProbe(probe, options(async () => Response.json({ keys: [{ kty: 'RSA', kid: 'test', n: 'test', e: 'AQAB' }] })))).status, 'passed');
});

test('arbitrary error messages cannot leak secrets into reports', async () => {
  const result = await runProbe(page, options(async () => { throw new Error('sensitive-token=https://private.example'); }));
  assert.equal(result.reason, 'request-or-response-failed');
  assert.equal(JSON.stringify(result).includes('sensitive-token'), false);
});

test('batch concurrency is bounded and output order is stable', async () => {
  let active = 0;
  let peak = 0;
  const checks = Array.from({ length: 9 }, (_, id) => ({ ...page, id: String(id) }));
  const results = await runChecks(checks, options(async () => {
    peak = Math.max(peak, ++active);
    await new Promise(resolve => setImmediate(resolve));
    active--;
    return html('Working');
  }));
  assert.equal(peak, 4);
  assert.deepEqual(results.map(result => result.check), checks.map(check => check.id));
  assert.equal(probes.filter(probe => probe.kind === 'page').length, 6);
});
