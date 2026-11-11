import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser, jsonError } from "@/lib/api";
import { VercelSandboxJudge } from "@/lib/judge/vercel-sandbox";
import { MAX_SOURCE_BYTES, publicJudgeFailure } from "@/lib/judge/output";
import { getOutputChecker } from "@/lib/judge/config";

export const runtime = "nodejs";
export const maxDuration = 180;

const requestSchema = z.object({
  problemId: z.string().uuid(),
  language: z.enum(["python", "cpp"]),
  source: z.string().min(1),
});

export async function POST(request: Request) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  let raw: unknown;
  try { raw = await request.json(); } catch { return jsonError("Request body must be valid JSON.", 400); }
  const parsed = requestSchema.safeParse(raw);
  if (!parsed.success) return jsonError("Choose a problem, language, and non-empty source code.", 400);
  if (Buffer.byteLength(parsed.data.source, "utf8") > MAX_SOURCE_BYTES) return jsonError("Source code is limited to 64 KB.", 413);

  const admin = createAdminClient();
  const { data: problem } = await admin.from("problems").select("id,published,time_limit_ms,memory_limit_mb").eq("id", parsed.data.problemId).eq("published", true).maybeSingle();
  if (!problem) return jsonError("Problem not found.", 404);

  const { data: lease, error: leaseError } = await admin.rpc("claim_judge_lease", { p_user_id: auth.user.id, p_action: "run" });
  if (leaseError) return jsonError("The judge could not acquire a run slot. Try again shortly.", 503);
  if (!lease) return jsonError("The judge is busy or you have reached the run limit. Please wait a minute and try again.", 429);
  try {
    const { data: judgeConfig, error: configError } = await admin.from("problem_judge_configs").select("output_checker").eq("problem_id", problem.id).maybeSingle();
    let outputChecker;
    try { outputChecker = getOutputChecker(judgeConfig, configError); }
    catch { return jsonError("Could not load the private checker configuration.", 503); }
    const { data: tests, error } = await admin.from("test_cases").select("input,expected_output,is_sample,case_index").eq("problem_id", problem.id).eq("is_sample", true).order("case_index");
    if (error) return jsonError("Could not load public examples for this problem.", 503);
    const result = await new VercelSandboxJudge().judge({
      source: parsed.data.source,
      language: parsed.data.language,
      testCases: (tests ?? []).map(test => ({ input: test.input, expected_output: test.expected_output, is_sample: true, explanation: null })),
      timeLimitMs: problem.time_limit_ms,
      memoryLimitMb: problem.memory_limit_mb,
      samplesOnly: true,
      outputChecker,
    });
    return NextResponse.json(result);
  } catch (error) {
    return jsonError(publicJudgeFailure(error), 503);
  } finally {
    try { await admin.rpc("release_judge_lease", { p_lease_id: lease }); } catch { /* Lease expires automatically if the database is unavailable. */ }
  }
}
