import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin, getViewer } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { jsonError } from "@/lib/api";
import { MAX_INPUT_BYTES, MAX_OUTPUT_BYTES, MAX_TOTAL_TEST_BYTES } from "@/lib/judge/output";

const caseSchema = z.object({ case_index: z.number().int().min(0), input: z.string().max(MAX_INPUT_BYTES), expected_output: z.string().max(MAX_OUTPUT_BYTES), is_sample: z.boolean(), explanation: z.string().max(3000).nullable().optional() });
const problemSchema = z.object({
  id: z.string().uuid().optional(), slug: z.string().min(2).max(80).regex(/^[a-z0-9-]+$/), title: z.string().min(2).max(120), section: z.enum(["General","Code Quest Tryout"]).default("General"), difficulty: z.enum(["Easy","Medium","Hard"]),
  statement: z.string().max(30000), input_format: z.string().max(10000), output_format: z.string().max(10000), constraints: z.string().max(10000),
  time_limit_ms: z.number().int().min(100).max(5000), memory_limit_mb: z.number().int().min(64).max(1024), published: z.boolean(),
  tags: z.array(z.string().min(1).max(32)).max(15), test_cases: z.array(caseSchema).min(1).max(250),
  reference_solutions: z.object({ python:z.string().max(65536),cpp:z.string().max(65536),published:z.boolean() }),
});

export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) return jsonError(gate.error, gate.status);
  const admin = createAdminClient();
  const [{data,error},{data:stats,error:statsError}] = await Promise.all([
    admin.from("problems").select("*,problem_tags(tag)").order("created_at", { ascending: false }),
    admin.rpc("problem_submission_stats"),
  ]);
  if (error) return jsonError("Could not load the problem bank.", 503);
  if (statsError) return jsonError("Could not load submission statistics.",503);
  const byProblem=new Map((stats??[]).map((row:{problem_id:string;total_submissions:number;accepted_submissions:number})=>[row.problem_id,row]));
  return NextResponse.json({ problems: (data??[]).map(problem=>({ ...problem,submission_stats:byProblem.get(problem.id)??{total_submissions:0,accepted_submissions:0} })) });
}

export async function POST(request: Request) {
  const gate = await requireAdmin();
  if (!gate.ok) return jsonError(gate.error, gate.status);
  let raw: unknown;
  try { raw = await request.json(); } catch { return jsonError("Request body must be valid JSON.", 400); }
  const parsed = problemSchema.safeParse(raw);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Problem information is invalid.", 400);
  if (parsed.data.section === "Code Quest Tryout" && parsed.data.tags.length > 0) return jsonError("Code Quest tryout problems cannot have topic tags.", 400);
  if (!parsed.data.test_cases.some(test => test.is_sample)) return jsonError("Add at least one public sample test case.", 400);
  if (parsed.data.test_cases.some(test => Buffer.byteLength(test.input) > MAX_INPUT_BYTES || Buffer.byteLength(test.expected_output) > MAX_OUTPUT_BYTES)) return jsonError("A test input or expected output exceeds the judge's per-case size limit.", 400);
  if (parsed.data.test_cases.reduce((total, test) => total + Buffer.byteLength(test.input) + Buffer.byteLength(test.expected_output), 0) > MAX_TOTAL_TEST_BYTES) return jsonError("All test inputs and outputs combined must stay under 16 MB.", 400);
  const admin = createAdminClient();
  const viewer = await getViewer();
  const { data: problemId, error } = await admin.rpc("admin_save_problem", {
    p_problem: { ...parsed.data, test_cases: undefined, tags: undefined, created_by: viewer?.user.id },
    p_cases: parsed.data.test_cases,
    p_tags: parsed.data.tags.map(tag => tag.trim().toLowerCase()).filter(Boolean),
    p_reference: parsed.data.reference_solutions,
  });
  if (error) return jsonError(error.message.includes("duplicate key") ? "A problem already uses that slug." : error.message, 400);
  return NextResponse.json({ id: problemId }, { status: 201 });
}
