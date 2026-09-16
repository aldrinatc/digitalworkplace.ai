import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { syncIdentity, changeRole, requireSuperAdmin } from '../apps/main/src/lib/server/user-store';
import { ownedSession, finishSession, boundedMetric } from '../apps/main/src/lib/server/tracking-store';

const actor = '11111111-1111-4111-8111-111111111111';
const target = '22222222-2222-4222-8222-222222222222';
const identity = { id: 'user_verified', email: 'Owner@example.test', verified: true, name: 'Test Owner', avatar: null };
const user = { id: actor, clerk_id: null, email: 'owner@example.test', role: 'super_admin' };
function database(responses: Array<unknown | { failure: number; code: string }>) {
  const calls: Array<{ url: URL; method: string; body: Record<string, unknown> }> = [];
  const client = createClient('https://database.example.test', 'test-key', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: async (input, init) => {
      const url = new URL(String(input));
      calls.push({ url, method: init?.method || 'GET', body: init?.body ? JSON.parse(String(init.body)) : {} });
      assert.ok(responses.length, 'unexpected database request');
      const next = responses.shift();
      if (next && typeof next === 'object' && 'failure' in next) {
        const failure = next as { failure: number; code: string };
        return new Response(JSON.stringify({ code: failure.code, message: 'Synthetic database failure' }), { status: failure.failure });
      }
      return new Response(JSON.stringify(next), { status: 200, headers: { 'Content-Type': 'application/json' } });
    } },
  });
  return { client, calls };
}

test('verified email links an existing account and preserves its assigned role', async () => {
  const { client, calls } = database([[], [user], { ...user, clerk_id: identity.id }]);
  const result = await syncIdentity(client, identity);
  assert.equal(result.role, 'super_admin');
  assert.equal(calls[1].url.searchParams.get('email'), 'eq.owner@example.test');
  assert.equal(calls[2].body.clerk_id, identity.id);
  assert.equal(calls[2].body.role, undefined);
  assert.match(calls[2].url.searchParams.get('or')!, /clerk_id.is.null/);
});
test('new identities are created only as ordinary users', async () => {
  const { client, calls } = database([[], [], { ...user, role: 'user', clerk_id: identity.id }]);
  assert.equal((await syncIdentity(client, identity)).role, 'user');
  assert.equal(calls[2].body.role, 'user');
});
test('unverified emails cannot claim pre-existing users', async () => {
  const { client, calls } = database([]);
  await assert.rejects(syncIdentity(client, { ...identity, verified: false }), { status: 403 });
  assert.equal(calls.length, 0);
});
test('an email already linked to another Clerk user cannot be reassigned', async () => {
  const { client, calls } = database([[], [{ ...user, clerk_id: 'user_someone_else' }]]);
  await assert.rejects(syncIdentity(client, identity), { status: 409 });
  assert.equal(calls.length, 2);
});
test('zero-row writes fail instead of presenting a successful identity sync', async () => {
  const { client } = database([[], [user], null]);
  await assert.rejects(syncIdentity(client, identity), { status: 409 });
});
test('concurrent first sign-ins recover after a unique constraint race', async () => {
  const linked = { ...user, clerk_id: identity.id, role: 'user' };
  const { client } = database([[], [], { failure: 409, code: '23505' }, [linked], linked]);
  assert.equal((await syncIdentity(client, identity)).clerk_id, identity.id);
});
test('regular users cannot read the administrative user list or change roles', async () => {
  const { client, calls } = database([[{ id: actor, role: 'user' }], [{ id: actor, role: 'user' }]]);
  await assert.rejects(requireSuperAdmin(client, identity.id), { status: 403 });
  await assert.rejects(changeRole(client, identity.id, target, 'super_admin'), { status: 403 });
  assert.ok(calls.every(call => call.method === 'GET'));
});
test('super admins cannot demote themselves', async () => {
  const { client, calls } = database([[user]]);
  await assert.rejects(changeRole(client, identity.id, actor, 'user'), { status: 409 });
  assert.equal(calls.length, 1);
});
test('role updates report missing rows and reject unknown roles', async () => {
  const { client } = database([[user], null, [user]]);
  await assert.rejects(changeRole(client, identity.id, target, 'admin'), { status: 404 });
  await assert.rejects(changeRole(client, identity.id, target, 'owner'), { status: 400 });
});
test('role changes return the persisted database record', async () => {
  const { client, calls } = database([[user], { ...user, id: target, role: 'admin' }]);
  assert.equal((await changeRole(client, identity.id, target, 'admin')).role, 'admin');
  assert.deepEqual(calls[1].body, { role: 'admin' });
});
test('tracking checks both the session ID and authenticated owner', async () => {
  const { client, calls } = database([[]]);
  await assert.rejects(ownedSession(client, identity.id, target), { status: 404 });
  assert.equal(calls[0].url.searchParams.get('id'), `eq.${target}`);
  assert.equal(calls[0].url.searchParams.get('clerk_id'), `eq.${identity.id}`);
});
test('beacons cannot end another user’s session', async () => {
  const { client, calls } = database([[]]);
  await assert.rejects(finishSession(client, identity.id, target), { status: 404 });
  assert.equal(calls.length, 1);
});
test('session completion uses the server clock and surfaces write failures', async () => {
  const session = { id: target, user_id: actor, clerk_id: identity.id, started_at: new Date(Date.now()-10000).toISOString(), is_active: true };
  const { client, calls } = database([[session], { failure: 503, code: 'unavailable' }]);
  await assert.rejects(finishSession(client, identity.id, target));
  assert.equal(calls[1].body.is_active, false);
  assert.ok(Number(calls[1].body.duration_seconds) >= 10);
});
test('tracking rejects unbounded, negative, nonnumeric and nonfinite metrics', () => {
  for (const value of [-1, 101, NaN, Infinity, '50']) assert.throws(() => boundedMetric(value, 100));
  assert.equal(boundedMetric(40.8, 100), 40);
});
