import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | undefined;

/** Server credentials must never silently degrade to anonymous database access. */
export function getAdminDatabase(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Workplace database credentials are not configured');
  return client ??= createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
