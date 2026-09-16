import type { SupabaseClient } from '@supabase/supabase-js';
import { WorkplaceError } from './user-store';

export async function ownedSession(db: SupabaseClient, clerkId: string, sessionId: unknown) {
  if (typeof sessionId !== 'string' || !/^[0-9a-f-]{36}$/i.test(sessionId)) throw new WorkplaceError(400, 'Invalid session');
  const { data, error } = await db.from('user_sessions').select('id,user_id,clerk_id,started_at,is_active')
    .eq('id', sessionId).eq('clerk_id', clerkId).maybeSingle();
  if (error) throw error;
  if (!data) throw new WorkplaceError(404, 'Session not found');
  return data as { id: string; user_id: string; clerk_id: string; started_at: string; is_active: boolean };
}

export async function finishSession(db: SupabaseClient, clerkId: string, sessionId: unknown) {
  const session = await ownedSession(db, clerkId, sessionId);
  const { error } = await db.from('user_sessions').update({
    ended_at: new Date().toISOString(), is_active: false,
    duration_seconds: Math.max(0, Math.floor((Date.now() - Date.parse(session.started_at)) / 1000)),
  }).eq('id', session.id).eq('clerk_id', clerkId);
  if (error) throw error;
}

export function boundedMetric(value: unknown, max: number): number {
  const number = value === undefined ? 0 : value;
  if (typeof number !== 'number' || !Number.isFinite(number) || number < 0 || number > max) {
    throw new WorkplaceError(400, 'Invalid tracking metric');
  }
  return Math.floor(number);
}

export function trackingText(value: unknown, max: number, required = false): string | null {
  if (value === undefined || value === null || value === '') {
    if (required) throw new WorkplaceError(400, 'Missing tracking field');
    return null;
  }
  if (typeof value !== 'string' || value.length > max) throw new WorkplaceError(400, 'Invalid tracking field');
  return value;
}
