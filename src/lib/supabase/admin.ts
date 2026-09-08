import { createClient } from "@supabase/supabase-js";

// Service-role client — bypasses RLS entirely, never import this into a
// "use client" file. Only for privileged server-side operations (e.g.
// supabase.auth.admin.inviteUserByEmail) that the anon-key client can't do.
export function createAdminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
