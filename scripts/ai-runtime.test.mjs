import { readFileSync } from 'node:fs';
import { scoreFAQMatch, scoreMatch } from '../apps/chat-core-iq/src/lib/knowledge-ranking.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { resilientAIFetch, currentModel, aiHealth, gatewayToken } from '../packages/ai-runtime/provider.ts';
import { searchTerms, keywordRelevance, isPersistedThread } from '../apps/intranet-iq/src/lib/retrieval-quality.ts';

const originalFetch = globalThis.fetch;
const envNames = ['AI_GATEWAY_API_KEY', 'VERCEL_OIDC_TOKEN', 'ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'AI_EMBEDDING_ROUTE'];
const saved = Object.fromEntries(envNames.map(key => [key, process.env[key]]));
test.afterEach(() => {
  globalThis.fetch = originalFetch;
  delete globalThis[Symbol.for('@vercel/request-context')];
  for (const key of envNames) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});
function configure() {
  for (const key of envNames) delete process.env[key];
  process.env.VERCEL_OIDC_TOKEN = 'test-oidc';
  process.env.ANTHROPIC_API_KEY = 'test-direct';
}
const request = () => resilientAIFetch('https://api.anthropic.com/v1/messages', {
  method: 'POST', headers: { 'x-api-key': 'old-key', 'content-type': 'application/json' },
  body: JSON.stringify({ model: 'claude-3-sonnet-20240229', messages: [{ role: 'user', content: 'Synthetic test' }], max_tokens: 32 }),
});

test('generation uses approved gateway/OpenAI only and strips the old credential', async () => {
  configure();
  globalThis.fetch = async (url, init) => {
    assert.equal(url, 'https://ai-gateway.vercel.sh/v1/messages');
    assert.equal(init.headers.get('x-api-key'), null);
    assert.equal(init.headers.get('authorization'), 'Bearer test-oidc');
    const body = JSON.parse(init.body);
    assert.equal(body.model, 'openai/gpt-4o-mini');
    assert.deepEqual(body.providerOptions.gateway.only, ['openai']);
    return Response.json({ content: [{ type: 'text', text: 'OK' }] });
  };
  assert.equal((await request()).status, 200);
});
test('gateway outage falls back once to the existing direct provider and supported model', async () => {
  configure(); let calls = 0;
  globalThis.fetch = async (url, init) => {
    if (++calls === 1) return Response.json({ error: 'unavailable' }, { status: 503 });
    assert.equal(url, 'https://api.anthropic.com/v1/messages');
    assert.equal(init.headers.get('authorization'), null);
    assert.equal(init.headers.get('x-api-key'), 'test-direct');
    assert.equal(JSON.parse(init.body).model, 'claude-sonnet-4-6');
    return Response.json({ content: [{ type: 'text', text: 'OK' }] });
  };
  assert.equal((await request()).status, 200); assert.equal(calls, 2);
});
test('exhausted providers return a failure status, never a fabricated success', async () => {
  configure(); let calls = 0;
  globalThis.fetch = async () => { calls++; return Response.json({ error: 'quota' }, { status: 429 }); };
  assert.equal((await request()).status, 429); assert.equal(calls, 2);
});
test('embeddings never move to gateway or change vector models', async () => {
  configure(); process.env.OPENAI_API_KEY = 'embedding-key';
  globalThis.fetch = async request => {
    assert.equal(request.headers.get('authorization'), 'Bearer embedding-key');
    assert.equal(request.url, 'https://api.openai.com/v1/embeddings');
    assert.equal((await request.json()).model, 'text-embedding-3-small');
    return Response.json({ data: [] });
  };
  await resilientAIFetch('https://api.openai.com/v1/embeddings', { method: 'POST', body: JSON.stringify({ model: 'text-embedding-3-small', input: 'Synthetic' }) });
});
test('unconfigured service fails closed', async () => {
  configure(); delete process.env.VERCEL_OIDC_TOKEN; delete process.env.ANTHROPIC_API_KEY;
  assert.equal((await request()).status, 503);
});
test('low balance is degraded and the amount is not exposed', async () => {
  configure(); globalThis.fetch = async () => Response.json({ balance: '0.50' });
  assert.deepEqual(await aiHealth(), { status: 'degraded', gateway: 'available', funding: 'low' });
});
test('retired Claude model identifiers are migrated', () => {
  assert.equal(currentModel('claude-3-haiku-20240307'), 'claude-haiku-4-5-20251001');
  assert.equal(currentModel('claude-sonnet-4-20250514'), 'claude-sonnet-4-6');
});
test('remote work retrieval ignores question stopwords and ranks matching policy first', () => {
  const terms = searchTerms('What is the remote work policy?');
  assert.deepEqual(terms, ['remote', 'work', 'policy']);
  assert.ok(keywordRelevance(terms, 'Remote Work Policy', 'Work remotely') > keywordRelevance(terms, 'VPN Access', 'The VPN is available'));
  assert.deepEqual(searchTerms('the,what)(is'), []);
});
test('demo thread IDs never reach UUID database queries', () => {
  assert.equal(isPersistedThread('thread-1'), false);
  assert.equal(isPersistedThread('0e9475aa-a111-4111-8111-112233445566'), true);
});

test('runtime OIDC uses fresh request identity without a production env token', () => {
  configure(); delete process.env.VERCEL_OIDC_TOKEN;
  let token = 'request-1';
  globalThis[Symbol.for('@vercel/request-context')] = { get: () => ({ headers: { 'x-vercel-oidc-token': token } }) };
  assert.equal(gatewayToken(), 'request-1');
  token = 'request-2';
  assert.equal(gatewayToken(), 'request-2');
});

test('city hours query cannot be hijacked by generic FAQ keywords or punctuation', () => {
  const query = 'What are City Hall hours?';
  const unrelated = { title: 'Property Report', keywords: ['what is my property', 'city services'], priority: 100 };
  const related = { title: 'City Hall hours', keywords: ['city hall'], priority: 10 };
  assert.equal(scoreFAQMatch(unrelated, query), 0);
  assert.ok(scoreFAQMatch(related, query) > 50);
  assert.equal(scoreMatch({ title: 'Unrelated', content: 'The city has great services' }, query), 0);
  assert.equal(scoreMatch({ title: 'Unrelated', content: 'some text' }, '([*'), 0);
});

test('verified government-center hours rank first and retain their official citation', () => {
  const faqs = JSON.parse(readFileSync(new URL('../apps/chat-core-iq/data/demo-faq.json', import.meta.url)));
  const top = faqs.map(faq => ({ faq, score: scoreFAQMatch(faq, 'What are City Hall hours?') })).sort((a, b) => b.score - a.score)[0];
  assert.equal(top.faq.id, 'verified-government-center-hours');
  assert.match(top.faq.verifiedAnswer.en, /City Clerk/);
  assert.match(top.faq.verifiedAnswer.en, /8 AM–5 PM/);
  assert.ok(top.faq.verifiedAnswer.en.includes(top.faq.url));
});


test('embedding gateway is opt-in, OpenAI-only, and keeps the existing 1536 dimensions', async () => {
  configure(); process.env.AI_EMBEDDING_ROUTE = 'vercel-openai';
  globalThis.fetch = async request => {
    assert.equal(request.url, 'https://ai-gateway.vercel.sh/v1/embeddings');
    assert.equal(request.headers.get('authorization'), 'Bearer test-oidc');
    const body = await request.json();
    assert.equal(body.model, 'openai/text-embedding-3-small');
    assert.equal(body.dimensions, 1536);
    assert.deepEqual(body.providerOptions.gateway.only, ['openai']);
    return Response.json({ data: [] });
  };
  await resilientAIFetch('https://api.openai.com/v1/embeddings', { method: 'POST', body: JSON.stringify({ model: 'text-embedding-3-small', input: 'Synthetic' }) });
});
