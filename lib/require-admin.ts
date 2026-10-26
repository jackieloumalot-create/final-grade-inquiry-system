import { createSupabaseServerClient } from '@/lib/supabase-server';

export async function requireAdmin() {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return { ok: false as const, status: 401, message: 'Please sign in again.' };
  const { data: adminRecord, error } = await supabase
    .from('admin_users').select('user_id').eq('user_id', user.id).maybeSingle();
  if (error || !adminRecord) return { ok: false as const, status: 403, message: 'This account is not authorized to manage grades.' };
  return { ok: true as const, user };
}
