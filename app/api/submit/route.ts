import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser, jsonError } from "@/lib/api";
import { VercelSandboxJudge } from "@/lib/judge/vercel-sandbox";
import { MAX_SOURCE_BYTES, publicJudgeFailure } from "@/lib/judge/output";
import type { JudgeOutput } from "@/lib/judge/types";

export const runtime = "nodejs";
export const maxDuration = 180;

const requestSchema = z.object({ problemId: z.string().uuid(), language: z.enum(["python", "cpp"]), source: z.string().min(1) });

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

  const { data: lease, error: leaseError } = await admin.rpc("claim_judge_lease", { p_user_id: auth.user.id, p_action: "submit" });
  if (leaseError) return jsonError("The judge could not acquire a submission slot. Try again shortly.", 503);
  if (!lease) return jsonError("The judge is busy or you have reached the submission limit. Please wait a minute and try again.", 429);

  let submissionId: string | null = null;
  try {
    const { data: submission, error: insertError } = await admin.from("submissions").insert({
      user_id: auth.user.id,
      problem_id: problem.id,
      language: parsed.data.language,
      source_code: parsed.data.source,
      verdict: "Pending",
    }).select("id").single();
    if (insertError || !submission) return jsonError("Could not create your submission record. Please retry.", 503);
    submissionId = submission.id;

    let result: JudgeOutput;
    try {
      const { data: tests, error: testsError } = await admin.from("test_cases").select("input,expected_output,is_sample,case_index").eq("problem_id", problem.id).order("case_index");
      if (testsError || !tests?.length) throw new Error("This problem does not have judge test cases configured.");
      result = await new VercelSandboxJudge().judge({
        source: parsed.data.source,
        language: parsed.data.language,
        testCases: tests.map(test => ({ input: test.input, expected_output: test.expected_output, is_sample: test.is_sample, explanation: null })),
        timeLimitMs: problem.time_limit_ms,
        memoryLimitMb: problem.memory_limit_mb,
        samplesOnly: false,
      });
    } catch (error) {
      result = { verdict: "Judging Error", executionTimeMs: null, passedTestCases: 0, totalTestCases: 0, errorMessage: publicJudgeFailure(error), cases: [] };
    }

    const errorMessage = result.verdict === "Judging Error" ? (result.errorMessage || "The judge service could not complete this run. Your code was not marked Accepted. Please retry in a moment.") : result.errorMessage;
    const { error: updateError } = await admin.from("submissions").update({
      verdict: result.verdict,
      execution_time_ms: result.executionTimeMs,
      passed_test_cases: result.passedTestCases,
      total_test_cases: result.totalTestCases,
      error_message: errorMessage,
    }).eq("id", submissionId);
    if (updateError) return jsonError("The result was judged, but could not be saved. Refresh your submission history before retrying.", 503);

    // Hidden-test output and expected values are intentionally omitted from the response.
    return NextResponse.json({ submissionId, verdict: result.verdict, executionTimeMs: result.executionTimeMs, passedTestCases: result.passedTestCases, totalTestCases: result.totalTestCases, errorMessage, cases: result.cases });
  } catch (error) {
    if (submissionId) {
      await admin.from("submissions").update({ verdict: "Judging Error", error_message: "The judging service did not complete. Please resubmit." }).eq("id", submissionId);
    }
    return jsonError(error instanceof Error ? error.message : "The submission could not be processed.", 503);
  } finally {
    try { await admin.rpc("release_judge_lease", { p_lease_id: lease }); } catch { /* Lease expires automatically if the database is unavailable. */ }
  }
}
