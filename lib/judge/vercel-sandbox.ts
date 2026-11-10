import "server-only";
import { gzipSync } from "node:zlib";
import { Sandbox } from "@vercel/sandbox";
import type { JudgeInput, JudgeOutput, JudgeProvider } from "@/lib/judge/types";
import { truncate, MAX_INPUT_BYTES, MAX_OUTPUT_BYTES, MAX_TOTAL_TEST_BYTES, MAX_DIAGNOSTIC_CHARS } from "@/lib/judge/output";

const SANDBOX_SESSION_MS = 120_000;
const SANDBOX_CREATE_TIMEOUT_MS = 20_000;
const COMPILER_TIMEOUT_MS = 25_000;
const TOTAL_TEST_BUDGET_MS = 35_000;
const RUNNER_COMMAND_TIMEOUT_MS = TOTAL_TEST_BUDGET_MS + 5_000;
const SANDBOX_STOP_TIMEOUT_MS = 3_000;

// Trusted orchestration runs once in the sandbox. Each untrusted solution run
// is still a separate process with its own CPU, address-space, and file limits.
const RUNNER_SCRIPT = String.raw`import gzip
import json
import os
import re
import resource
import signal
import subprocess
import tempfile
import time

ROOT = "/vercel/sandbox"
with gzip.open(ROOT + "/cases.json.gz", "rt", encoding="utf-8") as cases_file:
    config = json.load(cases_file)

language = config["language"]
time_limit_ms = config["time_limit_ms"]
memory_limit_bytes = config["memory_limit_mb"] * 1024 * 1024
max_output_bytes = config["max_output_bytes"]
total_budget_seconds = config["total_budget_ms"] / 1000
samples_only = config["samples_only"]
cases = config["test_cases"]
command = ["python3", ROOT + "/main.py"] if language == "python" else [ROOT + "/main"]
started = time.monotonic()
elapsed_total_ms = 0
results = []
passed = 0
verdict = "Accepted"
error_message = None

def normalize(value):
    value = value.replace("\r\n", "\n").replace("\r", "\n")
    value = "\n".join(line.rstrip(" \t") for line in value.split("\n"))
    return value.rstrip("\n")

def child_limits():
    resource.setrlimit(resource.RLIMIT_AS, (memory_limit_bytes, memory_limit_bytes))
    resource.setrlimit(resource.RLIMIT_FSIZE, (max_output_bytes, max_output_bytes))
    resource.setrlimit(resource.RLIMIT_CORE, (0, 0))
    cpu_seconds = max(1, (time_limit_ms + 999) // 1000)
    resource.setrlimit(resource.RLIMIT_CPU, (cpu_seconds, cpu_seconds + 1))

for index, test in enumerate(cases, start=1):
    if time.monotonic() - started >= total_budget_seconds:
        verdict = "Judging Error"
        error_message = "The isolated runner exceeded its platform time budget. The submission was not marked Accepted."
        break

    timed_out = False
    elapsed_ms = 0
    with tempfile.TemporaryFile() as stdout_file, tempfile.TemporaryFile() as stderr_file:
        process = subprocess.Popen(
            command,
            stdin=subprocess.PIPE,
            stdout=stdout_file,
            stderr=stderr_file,
            preexec_fn=child_limits,
            start_new_session=True,
        )
        run_started = time.monotonic()
        try:
            process.communicate(input=test["input"].encode("utf-8"), timeout=time_limit_ms / 1000)
        except subprocess.TimeoutExpired:
            timed_out = True
            try:
                os.killpg(process.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
            process.communicate()
        finally:
            # Also stop any background children the submitted program left behind.
            try:
                os.killpg(process.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
        elapsed_ms = max(0, round((time.monotonic() - run_started) * 1000))
        elapsed_total_ms += elapsed_ms
        output_size = os.fstat(stdout_file.fileno()).st_size
        stdout_file.seek(0)
        actual = stdout_file.read(max_output_bytes + 1).decode("utf-8", errors="replace")
        stderr_file.seek(0)
        stderr = stderr_file.read(16_000).decode("utf-8", errors="replace")

    item = {"index": index, "passed": False, "executionTimeMs": elapsed_ms}
    if timed_out:
        verdict = "Time Limit Exceeded"
        error_message = "Time limit exceeded on a public sample." if samples_only else "Time limit exceeded on an official test. Hidden test data is private."
    elif output_size >= max_output_bytes:
        verdict = "Runtime Error"
        error_message = "Your program produced too much output. Output is limited to 2 MB per test case."
    elif process.returncode != 0:
        if re.search(r"MemoryError|Cannot allocate memory|std::bad_alloc|out of memory", stderr, re.I):
            verdict = "Memory Limit Exceeded"
            error_message = "Memory limit exceeded on a public sample." if samples_only else "Memory limit exceeded on an official test. Hidden test data is private."
        else:
            verdict = "Runtime Error"
            error_message = stderr.strip()[:2000] or "Program exited with code %s." % process.returncode
            if not samples_only:
                error_message = "The program failed on an official test. Hidden test data is private."
    elif normalize(actual) != normalize(test["expected_output"]):
        verdict = "Wrong Answer"
        error_message = "Output differed on a public sample." if samples_only else "The output did not match an official test. Hidden test data and output are private."
    else:
        item["passed"] = True
        passed += 1

    if samples_only or test.get("is_sample", False):
        item.update({
            "input": test["input"][:8000],
            "expectedOutput": test["expected_output"][:8000],
            "actualOutput": actual[:8000],
        })
    elif not item["passed"]:
        item["message"] = error_message
    if samples_only or test.get("is_sample", False) or not item["passed"]:
        results.append(item)
    if verdict != "Accepted":
        break

result = {
    "verdict": verdict,
    "executionTimeMs": elapsed_total_ms,
    "passedTestCases": passed,
    "errorMessage": error_message,
    "cases": results,
}
with open(ROOT + "/judge-result.json", "w", encoding="utf-8") as result_file:
    json.dump(result, result_file, ensure_ascii=False)
`;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), timeoutMs);
    }),
  ]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

async function fileText(sandbox: Sandbox, path: string, maxBytes = MAX_OUTPUT_BYTES) {
  try {
    const buffer = await sandbox.readFileToBuffer({ path });
    if (!buffer) return "";
    return buffer.subarray(0, maxBytes).toString("utf8");
  } catch {
    return "";
  }
}

type RunnerResult = Pick<JudgeOutput, "verdict" | "executionTimeMs" | "passedTestCases" | "errorMessage" | "cases">;

export class VercelSandboxJudge implements JudgeProvider {
  async judge(input: JudgeInput): Promise<JudgeOutput> {
    const tests = input.samplesOnly ? input.testCases.filter(test => test.is_sample) : input.testCases;
    if (!tests.length) throw new Error("This problem does not have any public sample tests yet.");
    if (tests.length > 250) throw new Error("This problem has more than 250 judge tests. Ask an administrator to reduce the test set.");
    let totalTestBytes = 0;
    for (const test of tests) {
      const inputBytes = Buffer.byteLength(test.input, "utf8");
      const outputBytes = Buffer.byteLength(test.expected_output, "utf8");
      if (inputBytes > MAX_INPUT_BYTES) throw new Error("A judge input is larger than the supported 3 MB limit.");
      if (outputBytes > MAX_OUTPUT_BYTES) throw new Error("A judge expected output is larger than the supported 2 MB limit.");
      totalTestBytes += inputBytes + outputBytes;
    }
    if (totalTestBytes > MAX_TOTAL_TEST_BYTES) throw new Error("This problem exceeds the 4 MB total judge-data limit.");

    const compressedCases = gzipSync(JSON.stringify({
      language: input.language,
      time_limit_ms: Math.max(100, Math.min(5_000, input.timeLimitMs)),
      memory_limit_mb: Math.max(64, Math.min(1_024, input.memoryLimitMb)),
      max_output_bytes: MAX_OUTPUT_BYTES,
      total_budget_ms: TOTAL_TEST_BUDGET_MS,
      samples_only: input.samplesOnly,
      test_cases: tests.map(test => ({ input: test.input, expected_output: test.expected_output, is_sample: test.is_sample })),
    }), { level: 1 });
    const snapshotId = process.env.VERCEL_SANDBOX_SNAPSHOT_ID?.trim();

    let sandbox: Sandbox;
    try {
      const sandboxOptions = {
        persistent: false as const,
        timeout: SANDBOX_SESSION_MS,
        resources: { vcpus: 1 as const },
      };
      sandbox = await withTimeout(
        snapshotId
          ? Sandbox.create({ ...sandboxOptions, source: { type: "snapshot", snapshotId }, networkPolicy: "deny-all" })
          : Sandbox.create({ ...sandboxOptions, networkPolicy: input.language === "cpp" ? "allow-all" : "deny-all" }),
        SANDBOX_CREATE_TIMEOUT_MS,
        "The isolated runner did not start within 20 seconds. Please retry.",
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (message.startsWith("The isolated runner did not start within ")) throw error;
      if (snapshotId && /snapshot_(not_found|region_mismatch)|snapshot.*(expired|not found|region)/i.test(message)) {
        throw new Error("The configured judge snapshot is expired or unavailable in this Vercel region. Create a new judge snapshot and update VERCEL_SANDBOX_SNAPSHOT_ID.");
      }
      throw new Error("Vercel could not start the judge sandbox. Please retry in a moment.");
    }

    try {
      const codePath = input.language === "python" ? "/vercel/sandbox/main.py" : "/vercel/sandbox/main.cpp";
      await withTimeout(
        sandbox.writeFiles([
          { path: codePath, content: Buffer.from(input.source, "utf8") },
          { path: "/vercel/sandbox/cases.json.gz", content: compressedCases },
          { path: "/vercel/sandbox/runner.py", content: Buffer.from(RUNNER_SCRIPT, "utf8") },
        ]),
        12_000,
        "The isolated runner could not receive the test data within 12 seconds.",
      );

      if (input.language === "cpp") {
        const hasCompiler = await withTimeout(
          sandbox.runCommand({ cmd: "bash", args: ["-lc", "command -v g++ >/dev/null 2>&1"], timeoutMs: 2_000 }),
          4_000,
          "The sandbox did not respond while checking for the C++ compiler.",
        );
        if (hasCompiler.exitCode !== 0) {
          if (snapshotId) {
            throw new Error("The configured judge snapshot does not contain g++. Recreate the prepared judge snapshot and update VERCEL_SANDBOX_SNAPSHOT_ID.");
          }
          if (process.env.VERCEL === "1") {
            throw new Error("C++ judging is not prepared in this Vercel deployment. Create a runtime snapshot with `npm run judge:snapshot`, add its ID as VERCEL_SANDBOX_SNAPSHOT_ID for Production and Preview, then redeploy.");
          }
          const install = await withTimeout(
            sandbox.runCommand({
              cmd: "bash",
              args: ["-lc", "sudo apt-get update -qq && sudo apt-get install -y -qq g++"],
              timeoutMs: COMPILER_TIMEOUT_MS,
            }),
            COMPILER_TIMEOUT_MS + 3_000,
            "Preparing the C++ compiler exceeded the 28-second setup limit.",
          );
          if (install.exitCode !== 0) {
            throw new Error("The sandbox could not prepare g++ for C++17. Please retry later or contact a CSS admin if this repeats.");
          }
        }
        if (!snapshotId) {
          await withTimeout(
            sandbox.update({ networkPolicy: "deny-all" }),
            8_000,
            "The sandbox could not disable network access within 8 seconds.",
          );
        }
        const compiled = await withTimeout(
          sandbox.runCommand({
            cmd: "bash",
            args: ["-lc", "ulimit -v 524288; ulimit -f 16384; timeout --signal=KILL --kill-after=0.2s 20s g++ -std=c++17 -O2 -pipe /vercel/sandbox/main.cpp -o /vercel/sandbox/main 2>/vercel/sandbox/compile.txt"],
            timeoutMs: COMPILER_TIMEOUT_MS,
          }),
          COMPILER_TIMEOUT_MS + 3_000,
          "C++ compilation exceeded its 28-second limit.",
        );
        if (compiled.exitCode !== 0) {
          const diagnostics = truncate(await withTimeout(fileText(sandbox, "/vercel/sandbox/compile.txt", MAX_DIAGNOSTIC_CHARS), 5_000, ""));
          return { verdict: "Compilation Error", executionTimeMs: null, passedTestCases: 0, totalTestCases: tests.length, errorMessage: diagnostics || "The C++ compiler could not build your solution.", cases: [] };
        }
      } else {
        const compiled = await withTimeout(
          sandbox.runCommand({
            cmd: "bash",
            args: ["-lc", "ulimit -v 262144; ulimit -f 8192; timeout --signal=KILL 5s python3 -m py_compile /vercel/sandbox/main.py 2>/vercel/sandbox/compile.txt"],
            timeoutMs: 7_000,
          }),
          9_000,
          "Python compilation exceeded its 9-second limit.",
        );
        if (compiled.exitCode !== 0) {
          const diagnostics = truncate(await withTimeout(fileText(sandbox, "/vercel/sandbox/compile.txt", MAX_DIAGNOSTIC_CHARS), 5_000, ""));
          return { verdict: "Compilation Error", executionTimeMs: null, passedTestCases: 0, totalTestCases: tests.length, errorMessage: diagnostics || "Python could not compile your solution.", cases: [] };
        }
      }

      const run = await withTimeout(
        sandbox.runCommand({
          cmd: "python3",
          args: ["/vercel/sandbox/runner.py"],
          timeoutMs: RUNNER_COMMAND_TIMEOUT_MS,
        }),
        RUNNER_COMMAND_TIMEOUT_MS + 3_000,
        "The isolated runner exceeded its 43-second execution limit. The submission was not marked Accepted.",
      );
      if (run.exitCode !== 0) {
        throw new Error(`The isolated runner stopped before returning a result (exit code ${run.exitCode ?? "unknown"}).`);
      }

      const resultText = await withTimeout(
        fileText(sandbox, "/vercel/sandbox/judge-result.json", MAX_OUTPUT_BYTES),
        8_000,
        "The isolated runner could not return its result within 8 seconds.",
      );
      let result: RunnerResult;
      try {
        result = JSON.parse(resultText) as RunnerResult;
      } catch {
        throw new Error("The isolated runner returned an invalid result.");
      }
      if (!result || !["Accepted", "Wrong Answer", "Time Limit Exceeded", "Memory Limit Exceeded", "Runtime Error", "Judging Error"].includes(result.verdict)) {
        throw new Error("The isolated runner returned an invalid verdict.");
      }
      return {
        verdict: result.verdict,
        executionTimeMs: Number.isFinite(result.executionTimeMs) ? result.executionTimeMs : null,
        passedTestCases: Number.isInteger(result.passedTestCases) ? result.passedTestCases : 0,
        totalTestCases: tests.length,
        errorMessage: result.errorMessage ? truncate(result.errorMessage, 2_000) : null,
        cases: Array.isArray(result.cases) ? result.cases : [],
      };
    } finally {
      try {
        await withTimeout(sandbox.stop(), SANDBOX_STOP_TIMEOUT_MS, "Sandbox cleanup exceeded its time limit.");
      } catch {
        // The sandbox has its own 120-second lifetime limit if cleanup cannot complete.
      }
    }
  }
}
