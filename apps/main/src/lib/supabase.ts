import { createClient } from '@supabase/supabase-js';

// Browser access remains subject to RLS. Privileged access lives in lib/server.
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://unconfigured.invalid',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'unconfigured',
);
