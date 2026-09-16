import {hasWorkplaceAdminAccess} from '../apps/chat-core-iq/src/lib/server/workplace-access';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import postgres from 'postgres';
import {
  listAppointmentConfigs,
  saveAppointmentConfig,
  reserveAppointment,
  availableAppointmentSlots,
  WorkflowStoreError,
  persistServiceRequest,
} from '../apps/chat-core-iq/src/lib/server/workflow-store';
import {
  withConversationState,
  startWorkflow,
  getState,
} from '../apps/chat-core-iq/src/lib/conversation-state';
import {
  generateCrossChannelTokenWithMessages,
  redeemCrossChannelToken,
  getOrCreateSession,
  addMessageToSession,
  getSessionHistory,
} from '../apps/chat-core-iq/src/lib/channels/session-manager';
import {storeDocument,listDocuments,archiveDocument,searchDocumentEntries} from '../apps/chat-core-iq/src/lib/server/document-store';
import { database } from '../apps/chat-core-iq/src/lib/server/database';
const url = process.env.DATABASE_URL;
if (
  !url ||
  new URL(url).hostname !== '127.0.0.1' ||
  new URL(url).pathname !== '/dwp_recovery'
)
  throw new Error('Tests require the isolated local dwp_recovery database');
const sql = postgres(url, { max: 1, prepare: false });
let date: string;
test.before(async () => {
  await sql.unsafe(
    await readFile(
      new URL('./fixtures/dcq-workflow-schema.sql', import.meta.url),
      'utf8',
    ),
  );
  await sql.unsafe(
    await readFile(
      new URL(
        '../supabase/migrations/017_dcq_durable_workflows.sql',
        import.meta.url,
      ),
      'utf8',
    ),
  );
  await sql.unsafe(
    await readFile(
      new URL(
        '../supabase/migrations/018_dcq_server_role.sql',
        import.meta.url,
      ),
      'utf8',
    ),
  );
  for(const file of ['019_support_draft_storage.sql','020_dcq_document_storage.sql']) {
    await sql.unsafe(await readFile(new URL(`../supabase/migrations/${file}`,import.meta.url),'utf8'));
  }
  const day = new Date();
  day.setUTCDate(day.getUTCDate() + 3);
  date = day.toISOString().slice(0, 10);
  await saveAppointmentConfig({
    id: 'test-service',
    department: 'Synthetic test only',
    serviceName: 'Synthetic booking',
    description: 'Not a real booking',
    duration: 30,
    availableDays: [
      'sunday',
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
    ],
    timeSlots: [{ start: '09:00', end: '10:00' }],
    maxPerSlot: 1,
    leadTimeHours: 0,
    isActive: true,
  });
});
test.after(async () => {
  await sql.end();
  await (database() as postgres.Sql).end();
});
test('private runtime table denies anonymous and authenticated direct access', async () => {
  const [row] =
    await sql`select has_table_privilege('anon','dcq.runtime_state','SELECT') as anon,has_table_privilege('authenticated','dcq.runtime_state','SELECT') as authenticated,relrowsecurity from pg_class where oid='dcq.runtime_state'::regclass`;
  assert.equal(row.anon, false);
  assert.equal(row.authenticated, false);
  assert.equal(row.relrowsecurity, true);
});
test('concurrent booking requests cannot overbook one slot', async () => {
  const value = {
    configId: 'test-service',
    userName: 'Synthetic Recovery',
    userEmail: 'synthetic@example.invalid',
    userPhone: '',
    date,
    timeSlot: '09:00',
    status: 'confirmed' as const,
    reason: 'test',
    notes: 'test',
  };
  const results = await Promise.allSettled([
    reserveAppointment(value),
    reserveAppointment(value),
  ]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  const failure = results.find(
    (r) => r.status === 'rejected',
  ) as PromiseRejectedResult;
  assert.ok(failure.reason instanceof WorkflowStoreError);
  assert.equal(failure.reason.status, 409);
  assert.deepEqual(await availableAppointmentSlots('test-service', date), [
    '09:30',
  ]);
});
test('invalid service, closed time and past date cannot create a booking', async () => {
  const value = {
    configId: 'test-service',
    userName: 'Synthetic Recovery',
    userEmail: 'synthetic@example.invalid',
    userPhone: '',
    date,
    timeSlot: '11:00',
    status: 'confirmed' as const,
    reason: 'test',
    notes: 'test',
  };
  await assert.rejects(reserveAppointment(value), /no longer available/);
  await assert.rejects(
    reserveAppointment({ ...value, configId: 'missing' }),
    /unavailable/,
  );
  await assert.rejects(
    reserveAppointment({ ...value, date: '2020-01-01' }),
    /no longer available/,
  );
});
test('workflow state is durable and isolated across requests and fresh processes', async () => {
  await withConversationState('recovery-session-a', async () => {
    startWorkflow('recovery-session-a', 'appointment', {
      selectedServiceId: 'test-service',
    });
  });
  await withConversationState('recovery-session-b', async () => {
    assert.equal(getState('recovery-session-b'), null);
  });
  await withConversationState('recovery-session-a', async () => {
    assert.equal(getState('recovery-session-a')?.activeWorkflow, 'appointment');
  });
  const child = spawn(
    process.execPath,
    [
      '--import',
      'tsx',
      '--input-type=module',
      '-e',
      `import postgres from 'postgres';const s=postgres(process.env.DATABASE_URL);const r=await s\`select data->>'activeWorkflow' as workflow from dcq.runtime_state where namespace='workflow' and id='recovery-session-a'\`;if(r[0]?.workflow!=='appointment')process.exitCode=1;await s.end();`,
    ],
    { cwd: process.cwd(), env: process.env, stdio: 'pipe' },
  );
  const code = await new Promise<number | null>((resolve) =>
    child.on('exit', resolve),
  );
  assert.equal(code, 0);
});
test('transfer codes are random, durable and single-use under concurrent redemption', async () => {
  const history = [
    { role: 'user' as const, content: 'Synthetic transfer verification' },
  ];
  const first = await generateCrossChannelTokenWithMessages(
    'ivr',
    'synthetic-a',
    history,
  );
  const second = await generateCrossChannelTokenWithMessages(
    'ivr',
    'synthetic-a',
    history,
  );
  assert.match(first, /^[A-F0-9]{12}$/);
  assert.notEqual(first, second);
  const results = await Promise.all([
    redeemCrossChannelToken(first, 'web', 'synthetic-target'),
    redeemCrossChannelToken(first, 'web', 'synthetic-target'),
  ]);
  assert.equal(results.filter(Boolean).length, 1);
  assert.equal(results.find(Boolean)?.messages[0].content, history[0].content);
  assert.equal(
    await redeemCrossChannelToken('ABCDEF', 'web', 'synthetic-target'),
    null,
  );
  assert.equal(
    await redeemCrossChannelToken('000000000000', 'web', 'synthetic-target'),
    null,
  );
  await sql`update dcq.runtime_state set expires_at=now()-interval '1 second' where namespace='transfer' and id=${second}`;
  assert.equal(
    await redeemCrossChannelToken(second, 'web', 'synthetic-target'),
    null,
  );
});
test('channel messages and service requests persist outside process memory', async () => {
  await getOrCreateSession('sms', 'synthetic-channel');
  await addMessageToSession(
    'sms',
    'synthetic-channel',
    'user',
    'Synthetic retained message',
  );
  assert.equal(
    (await getSessionHistory('sms', 'synthetic-channel'))[0].content,
    'Synthetic retained message',
  );
  const saved = await persistServiceRequest({
    category: 'Synthetic',
    department: 'Recovery test',
    priority: 'low',
    description: 'Synthetic service request',
    location: 'Test only',
    status: 'submitted',
    slaHours: 72,
  });
  const rows =
    await sql`select count(*)::int as count from dcq.service_requests where request_number=${saved.id}`;
  assert.equal(rows[0].count, 1);
  assert.equal((await listAppointmentConfigs()).length, 1);
});

test('the runtime database role cannot read account emails or grant itself privileges', async () => {
  const [row] =
    await sql`select has_column_privilege('dcq_runtime','public.users','email','SELECT') as emails,has_table_privilege('dcq_runtime','public.users','UPDATE') as change_users,has_table_privilege('dcq_runtime','dcq.runtime_state','INSERT') as sessions`;
  assert.equal(row.emails, false);
  assert.equal(row.change_users, false);
  assert.equal(row.sessions, true);
});

test('document originals and searchable chunks persist, replacement and removal archive old versions',async()=>{
 const file={name:'synthetic.txt',type:'text/plain',content:Buffer.from('Synthetic workplace zebraconfirmation policy')};
 const entries=[{title:'Synthetic zebraconfirmation',content:file.content.toString(),section:'Documents',url:''}];
 const first=await storeDocument(file,entries);
 assert.ok((await listDocuments()).some(d=>d.id===first));
 assert.equal((await searchDocumentEntries('zebraconfirmation')).length,1);
 const second=await storeDocument(file,entries);
 assert.notEqual(first,second);
 assert.equal((await listDocuments()).filter(d=>d.filename===file.name).length,1);
 assert.equal((await searchDocumentEntries('zebraconfirmation')).length,1);
 await archiveDocument(second);
 assert.equal((await searchDocumentEntries('zebraconfirmation')).length,0);
 const [saved]=await sql`select count(*)::int as total from dcq.document_files where document_id in (${first},${second})`;
 assert.equal(saved.total,2);
});
test('support draft tables deny browser roles and allow only the scoped service role',async()=>{
 const [access]=await sql`select has_table_privilege('anon','public.dsq_drafts','SELECT') as anon,has_table_privilege('authenticated','public.dsq_drafts','SELECT') as authenticated`;
 assert.equal(access.anon,false);assert.equal(access.authenticated,false);
 await sql.begin(async tx=>{
  await tx`set local role dsq_runtime`;
  await tx`insert into public.dsq_drafts (id,"draftId","ticketId","ticketSubject","originalContent","draftContent","kbArticlesUsed","updatedAt") values ('synthetic-draft','synthetic-display','synthetic-ticket','Synthetic subject','Synthetic message','Synthetic reply',ARRAY[]::text[],now())`;
  await tx`insert into public.dsq_draft_versions (id,"draftId",content) values ('synthetic-version','synthetic-draft','Synthetic reply')`;
  const [r]=await tx`select d.status,v.version from public.dsq_drafts d join public.dsq_draft_versions v on v."draftId"=d.id where d.id='synthetic-draft'`;
  assert.equal(r.status,'PENDING_REVIEW');assert.equal(r.version,1);
  await tx`update public.dsq_drafts set status='APPROVED' where id='synthetic-draft'`;
 });
});

test('workplace authorization supports the production role enum and denies unknown users',async()=>{
 await sql`insert into public.users (id,clerk_id,role) values ('00000000-0000-4000-8000-000000000002','synthetic-workplace-admin','super_admin') on conflict(id) do update set clerk_id=excluded.clerk_id,role=excluded.role`;
 assert.equal(await hasWorkplaceAdminAccess('synthetic-workplace-admin'),true);
 assert.equal(await hasWorkplaceAdminAccess('synthetic-workplace-admin',true),true);
 assert.equal(await hasWorkplaceAdminAccess('unknown-workplace-user'),false);
});
