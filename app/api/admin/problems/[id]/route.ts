import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { jsonError } from "@/lib/api";
import { POST as saveProblem } from "@/app/api/admin/problems/route";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireAdmin();
  if (!gate.ok) return jsonError(gate.error, gate.status);
  const { id } = await params;
  const admin = createAdminClient();
  const { data, error } = await admin.from("problems").select("*,problem_tags(tag),test_cases(*),reference_solutions(*)").eq("id", id).maybeSingle();
  if (error || !data) return jsonError("Problem not found.", 404);
  return NextResponse.json({ problem: data });
}

export async function PUT(request: Request) {
  return saveProblem(request);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireAdmin();
  if (!gate.ok) return jsonError(gate.error, gate.status);
  const { id } = await params;
  const admin = createAdminClient();
  const { error } = await admin.from("problems").delete().eq("id", id);
  if (error) return jsonError("Could not delete this problem.", 503);
  return NextResponse.json({ deleted: true });
}
