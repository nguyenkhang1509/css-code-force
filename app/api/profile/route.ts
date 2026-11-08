import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, jsonError } from "@/lib/api";

const schema = z.object({ username: z.string().regex(/^[a-zA-Z0-9_]{3,24}$/), full_name: z.string().max(80).nullable().optional(), bio: z.string().max(280) });

export async function PATCH(request: Request) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  let raw: unknown;
  try { raw = await request.json(); } catch { return jsonError("Request body must be valid JSON.", 400); }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return jsonError("Check your username, name, and bio lengths.", 400);
  const { data, error } = await auth.client.from("profiles").update({ ...parsed.data, username: parsed.data.username.toLowerCase() }).eq("id", auth.user.id).select("id,username,full_name,bio,role,created_at").single();
  if (error?.code === "23505") return jsonError("That username is already taken.", 409);
  if (error || !data) return jsonError("Could not save your profile.", 503);
  return NextResponse.json({ profile: data });
}
