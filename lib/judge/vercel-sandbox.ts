import "server-only";
import { Sandbox } from "@vercel/sandbox";
import type { JudgeInput, JudgeOutput, JudgeProvider } from "@/lib/judge/types";
import { normalizeOutput, truncate, MAX_INPUT_BYTES, MAX_OUTPUT_BYTES, MAX_DIAGNOSTIC_CHARS } from "@/lib/judge/output";

const SANDBOX_SESSION_MS = 160_000;
const COMPILER_TIMEOUT_MS = 25_000;
const TOTAL_TEST_BUDGET_MS = 80_000;
const PLATFORM_OUTPUT_LIMIT = 300_000;

function shellScript(source: string) {
  return `#!/bin/bash\nset +e\nulimit -v "$CSS_MEMORY_KB"\nulimit -f 1024\ntimeout --signal=KILL --kill-after=0.2s "$CSS_TIMEOUT" ${source} < /vercel/sandbox/input.txt > /vercel/sandbox/output.txt 2> /vercel/sandbox/stderr.txt\nstatus=$?\nprintf '%s' "$status" > /vercel/sandbox/status.txt\nexit 0\n`;
}

function isMemoryError(stderr: string) {
  return /MemoryError|Cannot allocate memory|std::bad_alloc|out of memory/i.test(stderr);
}

function classifyRun(exitCode: number, stderr: string) {
  if (exitCode === 124 || exitCode === 137) return "Time Limit Exceeded" as const;
  if (isMemoryError(stderr)) return "Memory Limit Exceeded" as const;
  return "Runtime Error" as const;
}

async function fileText(sandbox: Sandbox, path: string, maxBytes = MAX_OUTPUT_BYTES) {
  const buffer = await sandbox.readFileToBuffer({ path });
  if (!buffer) return "";
  return buffer.subarray(0, maxBytes).toString("utf8");
}

export class VercelSandboxJudge implements JudgeProvider {
  async judge(input: JudgeInput): Promise<JudgeOutput> {
    const tests = input.samplesOnly ? input.testCases.filter(test => test.is_sample) : input.testCases;
    if (!tests.length) throw new Error("This problem does not have any public sample tests yet.");
    if (tests.length > 250) throw new Error("This problem has more than 250 judge tests. Ask an administrator to reduce the test set.");
    for (const test of tests) {
      if (Buffer.byteLength(test.input, "utf8") > MAX_INPUT_BYTES) throw new Error("A judge input is larger than the supported 64 KB limit.");
    }

    const overallStarted = performance.now();
    const sandbox = await Sandbox.create({
      persistent: false,
      timeout: SANDBOX_SESSION_MS,
      resources: { vcpus: 1 },
      networkPolicy: input.language === "cpp" ? "allow-all" : "deny-all",
    });
    const cases: JudgeOutput["cases"] = [];
    let executionTimeMs = 0;
    let passed = 0;
    let verdict: JudgeOutput["verdict"] = "Accepted";
    let errorMessage: string | null = null;

    try {
      const codePath = input.language === "python" ? "/vercel/sandbox/main.py" : "/vercel/sandbox/main.cpp";
      await sandbox.writeFiles([{ path: codePath, content: input.source }]);

      if (input.language === "cpp") {
        const hasCompiler = await sandbox.runCommand({ cmd: "bash", args: ["-lc", "command -v g++ >/dev/null 2>&1"], timeoutMs: 2_000 });
        if (hasCompiler.exitCode !== 0) {
          const install = await sandbox.runCommand({
            cmd: "bash",
            args: ["-lc", "sudo apt-get update -qq && sudo apt-get install -y -qq g++"],
            timeoutMs: COMPILER_TIMEOUT_MS,
          });
          if (install.exitCode !== 0) {
            return { verdict: "Judging Error", executionTimeMs: null, passedTestCases: 0, totalTestCases: tests.length, errorMessage: "The Sandbox runtime could not prepare g++ for C++17. Check the Vercel Sandbox image and outbound package access.", cases: [] };
          }
        }
        await sandbox.update({ networkPolicy: "deny-all" });
        const compiled = await sandbox.runCommand({
          cmd: "bash",
          args: ["-lc", "ulimit -v 524288; ulimit -f 16384; timeout --signal=KILL --kill-after=0.2s 20s g++ -std=c++17 -O2 -pipe /vercel/sandbox/main.cpp -o /vercel/sandbox/main 2>/vercel/sandbox/compile.txt"],
          timeoutMs: COMPILER_TIMEOUT_MS,
        });
        if (compiled.exitCode !== 0) {
          const diagnostics = truncate(await fileText(sandbox, "/vercel/sandbox/compile.txt", MAX_DIAGNOSTIC_CHARS));
          return { verdict: "Compilation Error", executionTimeMs: null, passedTestCases: 0, totalTestCases: tests.length, errorMessage: diagnostics || "The C++ compiler could not build your solution.", cases: [] };
        }
      } else {
        const compiled = await sandbox.runCommand({
          cmd: "bash",
          args: ["-lc", "ulimit -v 262144; ulimit -f 1024; timeout --signal=KILL 5s python3 -m py_compile /vercel/sandbox/main.py 2>/vercel/sandbox/compile.txt"],
          timeoutMs: 7_000,
        });
        if (compiled.exitCode !== 0) {
          const diagnostics = truncate(await fileText(sandbox, "/vercel/sandbox/compile.txt", MAX_DIAGNOSTIC_CHARS));
          return { verdict: "Compilation Error", executionTimeMs: null, passedTestCases: 0, totalTestCases: tests.length, errorMessage: diagnostics || "Python could not compile your solution.", cases: [] };
        }
      }

      for (let i = 0; i < tests.length; i++) {
        if (performance.now() - overallStarted >= TOTAL_TEST_BUDGET_MS) {
          verdict = "Time Limit Exceeded";
          errorMessage = "The submission exceeded the platform's total execution budget.";
          if (!input.samplesOnly) errorMessage = "The solution exceeded the overall time budget. Hidden test data is private.";
          break;
        }
        const test = tests[i];
        await sandbox.writeFiles([
          { path: "/vercel/sandbox/input.txt", content: test.input },
          { path: "/vercel/sandbox/run.sh", content: shellScript(input.language === "python" ? "python3 /vercel/sandbox/main.py" : "/vercel/sandbox/main") },
          { path: "/vercel/sandbox/status.txt", content: "" },
          { path: "/vercel/sandbox/output.txt", content: "" },
          { path: "/vercel/sandbox/stderr.txt", content: "" },
        ]);
        const started = performance.now();
        const run = await sandbox.runCommand({
          cmd: "bash",
          args: ["/vercel/sandbox/run.sh"],
          env: {
            CSS_TIMEOUT: `${(Math.min(5_000, Math.max(100, input.timeLimitMs)) / 1_000).toFixed(3)}s`,
            CSS_MEMORY_KB: String(Math.max(64, Math.min(1024, input.memoryLimitMb)) * 1024),
          },
          timeoutMs: Math.min(7_000, Math.max(1_500, input.timeLimitMs + 1_500)),
        });
        const time = run.durationMs ?? Math.round(performance.now() - started);
        executionTimeMs += time;
        const statusText = await fileText(sandbox, "/vercel/sandbox/status.txt", 32);
        const exitCode = Number.parseInt(statusText, 10);
        const actual = await fileText(sandbox, "/vercel/sandbox/output.txt", MAX_OUTPUT_BYTES);
        const stderr = truncate(await fileText(sandbox, "/vercel/sandbox/stderr.txt", 16_000), 2_000);
        const outputWasCapped = Buffer.byteLength(actual, "utf8") >= PLATFORM_OUTPUT_LIMIT;

        if (!Number.isFinite(exitCode) || run.exitCode !== 0) {
          verdict = "Judging Error";
          errorMessage = "The isolated runner stopped before it could return a result.";
          break;
        }
        if (outputWasCapped) {
          verdict = "Runtime Error";
          errorMessage = "Your program produced too much output. Output is limited to 300 KB per test case.";
        } else if (exitCode !== 0) {
          verdict = classifyRun(exitCode, stderr);
          errorMessage = verdict === "Time Limit Exceeded" ? `Time limit exceeded on test ${i + 1}.` : verdict === "Memory Limit Exceeded" ? `Memory limit exceeded on test ${i + 1}.` : truncate(stderr || `Program exited with code ${exitCode}.`, 2_000);
        } else if (normalizeOutput(actual) !== normalizeOutput(test.expected_output)) {
          verdict = "Wrong Answer";
          errorMessage = `Output differed on test ${i + 1}.`;
        } else {
          passed++;
          if (input.samplesOnly) cases.push({ index: i + 1, passed: true, input: truncate(test.input, 8_000), expectedOutput: truncate(test.expected_output, 8_000), actualOutput: truncate(actual, 8_000), executionTimeMs: time });
          continue;
        }

        if (input.samplesOnly) {
          cases.push({ index: i + 1, passed: false, input: truncate(test.input, 8_000), expectedOutput: truncate(test.expected_output, 8_000), actualOutput: truncate(actual, 8_000), executionTimeMs: time, message: errorMessage });
        } else {
          // Never return private test inputs, expected outputs, or program output for hidden tests.
          cases.push({ index: i + 1, passed: false, message: errorMessage });
        }
        break;
      }

      if (!input.samplesOnly && verdict !== "Accepted" && verdict !== "Judging Error") {
        errorMessage = verdict === "Time Limit Exceeded" ? "Time limit exceeded on an official test. Hidden test data is private." : verdict === "Memory Limit Exceeded" ? "Memory limit exceeded on an official test. Hidden test data is private." : verdict === "Wrong Answer" ? "The output did not match an official test. Hidden test data and output are private." : "The program failed on an official test. Hidden test data is private.";
        const failed = cases[0];
        if (failed) failed.message = errorMessage;
      }

      return { verdict, executionTimeMs, passedTestCases: passed, totalTestCases: tests.length, errorMessage, cases };
    } finally {
      await sandbox.stop().catch(() => undefined);
    }
  }
}
