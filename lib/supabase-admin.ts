import { createClient } from '@supabase/supabase-js';

// SERVER ONLY: Never import this file into a Client Component.
export function createSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing server-side Supabase environment variables.');
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}
