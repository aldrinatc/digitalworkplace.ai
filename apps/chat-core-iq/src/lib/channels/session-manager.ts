// Durable server-side channel sessions and single-use transfer codes.
import { randomBytes, randomUUID } from 'node:crypto';
import { database, inTransaction, pruneExpiredState } from '../server/database';
import { ChannelSession, ChannelType, SESSION_TIMEOUTS } from './types';
import { Language } from '../i18n';

function key(channel: ChannelType, userId: string) {
  if (
    !(channel in SESSION_TIMEOUTS) ||
    typeof userId !== 'string' ||
    !userId ||
    userId.length > 200
  )
    throw new Error('Invalid channel session');
  return `${channel}:${userId}`;
}
function hydrate(value: ChannelSession): ChannelSession {
  return {
    ...value,
    startTime: new Date(value.startTime),
    lastActivity: new Date(value.lastActivity),
    messages: value.messages.map((m) => ({
      ...m,
      timestamp: new Date(m.timestamp),
    })),
  };
}
async function read(
  channel: ChannelType,
  userId: string,
): Promise<ChannelSession | null> {
  const rows =
    await database()`select data from dcq.runtime_state where namespace='channel' and id=${key(channel, userId)} and expires_at>now()`;
  return rows.length ? hydrate(rows[0].data as ChannelSession) : null;
}
async function save(session: ChannelSession) {
  const sql = database();
  const value = JSON.parse(JSON.stringify(session));
  await sql`insert into dcq.runtime_state (namespace,id,data,expires_at) values ('channel',${key(session.channel, session.userId)},${sql.json(value)},${new Date(Date.now() + SESSION_TIMEOUTS[session.channel])})
    on conflict(namespace,id) do update set data=excluded.data,expires_at=excluded.expires_at,updated_at=now()`;
}
function fresh(
  channel: ChannelType,
  userId: string,
  language: Language,
): ChannelSession {
  return {
    sessionId: randomUUID(),
    channel,
    userId,
    startTime: new Date(),
    lastActivity: new Date(),
    language,
    messages: [],
  };
}
async function change(
  channel: ChannelType,
  userId: string,
  action: (session: ChannelSession | null) => Promise<ChannelSession | null>,
) {
  return inTransaction(async () => {
    await pruneExpiredState();
    await database()`select pg_advisory_xact_lock(hashtextextended(${`channel:${key(channel, userId)}`},0))`;
    const next = await action(await read(channel, userId));
    if (next) await save(next);
    return next;
  });
}
export async function getOrCreateSession(
  channel: ChannelType,
  userId: string,
  language: Language = 'en',
): Promise<ChannelSession> {
  return (await change(channel, userId, async (old) => ({
    ...(old || fresh(channel, userId, language)),
    lastActivity: new Date(),
  })))!;
}
export async function addMessageToSession(
  channel: ChannelType,
  userId: string,
  role: 'user' | 'assistant',
  content: string,
) {
  if (typeof content !== 'string' || content.length > 20000)
    throw new Error('Invalid message');
  await change(channel, userId, async (old) =>
    old
      ? {
          ...old,
          messages: [
            ...old.messages,
            { role, content, timestamp: new Date() },
          ].slice(-200),
          lastActivity: new Date(),
        }
      : null,
  );
}
export async function updateSessionLanguage(
  channel: ChannelType,
  userId: string,
  language: Language,
) {
  await change(channel, userId, async (old) =>
    old ? { ...old, language, lastActivity: new Date() } : null,
  );
}
export async function clearSession(channel: ChannelType, userId: string) {
  await database()`delete from dcq.runtime_state where namespace='channel' and id=${key(channel, userId)}`;
}
export async function getSessionHistory(channel: ChannelType, userId: string) {
  return (await getOrCreateSession(channel, userId)).messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));
}
export async function generateCrossChannelToken(
  sourceChannel: ChannelType,
  sourceUserId: string,
): Promise<string> {
  const session = await read(sourceChannel, sourceUserId);
  if (!session) throw new Error('No active session');
  return generateCrossChannelTokenWithMessages(
    sourceChannel,
    sourceUserId,
    session.messages,
    session.language,
  );
}
export async function generateCrossChannelTokenWithMessages(
  sourceChannel: ChannelType,
  sourceUserId: string,
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  language: Language = 'en',
): Promise<string> {
  key(sourceChannel, sourceUserId);
  if (
    !Array.isArray(messages) ||
    messages.length > 200 ||
    messages.some(
      (m) =>
        !['user', 'assistant'].includes(m.role) ||
        typeof m.content !== 'string' ||
        m.content.length > 20000,
    )
  )
    throw new Error('Invalid transfer messages');
  const sql = database();
  for (let attempt = 0; attempt < 3; attempt++) {
    const token = randomBytes(6).toString('hex').toUpperCase();
    const data = {
      sourceChannel,
      language,
      messages: messages.map((m) => ({
        ...m,
        timestamp: new Date().toISOString(),
      })),
    };
    const rows =
      await sql`insert into dcq.runtime_state (namespace,id,data,expires_at) values ('transfer',${token},${sql.json(data)},now()+interval '30 minutes') on conflict do nothing returning id`;
    if (rows.length) return token;
  }
  throw new Error('Could not issue transfer code');
}
export async function redeemCrossChannelToken(
  token: string,
  targetChannel: ChannelType,
  targetUserId: string,
): Promise<ChannelSession | null> {
  key(targetChannel, targetUserId);
  if (typeof token !== 'string' || !/^[A-F0-9]{12}$/i.test(token)) return null;
  return inTransaction(async () => {
    const rows =
      await database()`delete from dcq.runtime_state where namespace='transfer' and id=${token.toUpperCase()} and expires_at>now() returning data`;
    if (!rows.length) return null;
    const data = rows[0].data as {
      language: Language;
      messages: ChannelSession['messages'];
    };
    const session = hydrate({
      ...fresh(targetChannel, targetUserId, data.language),
      messages: data.messages,
    });
    await save(session);
    return session;
  });
}
export async function getSessionById(
  sessionId: string,
): Promise<ChannelSession | null> {
  if (!/^[0-9a-f-]{36}$/i.test(sessionId)) return null;
  const rows =
    await database()`select data from dcq.runtime_state where namespace='channel' and data->>'sessionId'=${sessionId} and expires_at>now() limit 1`;
  return rows.length ? hydrate(rows[0].data as ChannelSession) : null;
}
