import type { SupabaseClient } from '@supabase/supabase-js';
import type { UserData, UserRole } from '../userRole';

export const userColumns = 'id,clerk_id,email,full_name,avatar_url,role,created_at,updated_at';
export class WorkplaceError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export interface VerifiedIdentity {
  id: string;
  email: string;
  verified: boolean;
  name: string | null;
  avatar: string | null;
}

/** Call only with identity obtained from Clerk's server API, never request JSON. */
export async function syncIdentity(db: SupabaseClient, identity: VerifiedIdentity): Promise<UserData> {
  if (!identity.verified) throw new WorkplaceError(403, 'Verify your email before opening the workplace');
  const email = identity.email.toLowerCase();
  for (let attempt = 0; attempt < 2; attempt++) {
    const { data: linked, error: linkedError } = await db.from('users').select(userColumns)
      .eq('clerk_id', identity.id).maybeSingle();
    if (linkedError) throw linkedError;
    const { data: existing, error } = linked ? { data: linked, error: null } :
      await db.from('users').select(userColumns).eq('email', email).maybeSingle();
    if (error) throw error;
    if (existing?.clerk_id && existing.clerk_id !== identity.id) {
      throw new WorkplaceError(409, 'This email is linked to a different workplace identity');
    }
    const profile = { clerk_id: identity.id, email, full_name: identity.name, avatar_url: identity.avatar };
    // Preserve existing roles. New accounts always start with the user role.
    const result = existing
      ? await db.from('users').update(profile).eq('id', existing.id)
        .or(`clerk_id.is.null,clerk_id.eq.${identity.id}`).select(userColumns).maybeSingle()
      : await db.from('users').insert({ ...profile, role: 'user' }).select(userColumns).single();
    if (result.error?.code === '23505' && attempt === 0) continue;
    if (result.error) throw result.error;
    if (!result.data) throw new WorkplaceError(409, 'Your identity changed; reload and try again');
    return result.data as UserData;
  }
  throw new WorkplaceError(409, 'Your identity could not be linked');
}

export async function requireSuperAdmin(db: SupabaseClient, clerkId: string) {
  const { data, error } = await db.from('users').select('id,role').eq('clerk_id', clerkId).maybeSingle();
  if (error) throw error;
  if (data?.role !== 'super_admin') throw new WorkplaceError(403, 'Super Admin access is required');
  return data as { id: string; role: UserRole };
}

export async function changeRole(db: SupabaseClient, actorId: string, userId: string, role: unknown) {
  const actor = await requireSuperAdmin(db, actorId);
  if (!['user', 'admin', 'super_admin'].includes(String(role))) throw new WorkplaceError(400, 'Invalid role');
  if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(userId)) throw new WorkplaceError(400, 'Invalid user');
  if (actor.id === userId) throw new WorkplaceError(409, 'You cannot change your own role');
  const { data, error } = await db.from('users').update({ role }).eq('id', userId).select(userColumns).maybeSingle();
  if (error) throw error;
  if (!data) throw new WorkplaceError(404, 'User not found');
  return data as UserData;
}
