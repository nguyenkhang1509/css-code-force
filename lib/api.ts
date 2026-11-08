import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function requireUser() {
  const client = await createClient();
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) return { response: jsonError("Sign in to continue.", 401) } as const;
  const { data: profile } = await client.from("profiles").select("id,username,role").eq("id", user.id).maybeSingle();
  if (!profile) return { response: jsonError("Your profile is not ready. Please sign out and sign in again.", 403) } as const;
  return { client, user, profile } as const;
}
