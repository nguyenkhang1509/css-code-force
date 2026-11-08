import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function getViewer() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("id, username, full_name, bio, role, created_at").eq("id", user.id).maybeSingle();
  return profile ? { user, profile } : null;
}

type Viewer = NonNullable<Awaited<ReturnType<typeof getViewer>>>;
export async function requireAdmin(): Promise<{ ok: true; viewer: Viewer } | { ok: false; error: string; status: 401 | 403 }> {
  const viewer = await getViewer();
  if (!viewer) return { ok:false, error: "Sign in to continue.", status: 401 };
  const admin = createAdminClient();
  const { data } = await admin.from("profiles").select("role").eq("id", viewer.user.id).maybeSingle();
  if (data?.role !== "admin") return { ok:false, error: "Administrator access is required.", status: 403 };
  return { ok:true, viewer };
}
