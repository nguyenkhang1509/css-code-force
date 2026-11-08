import type { Language, TestCase, Verdict } from "@/lib/types";

export type JudgeInput = {
  source: string;
  language: Language;
  testCases: TestCase[];
  timeLimitMs: number;
  memoryLimitMb: number;
  samplesOnly: boolean;
};

export type JudgeOutput = {
  verdict: Verdict;
  executionTimeMs: number | null;
  passedTestCases: number;
  totalTestCases: number;
  errorMessage: string | null;
  cases: Array<{
    index: number;
    passed: boolean;
    input?: string;
    expectedOutput?: string;
    actualOutput?: string;
    executionTimeMs?: number;
    message?: string;
  }>;
};

export interface JudgeProvider {
  judge(input: JudgeInput): Promise<JudgeOutput>;
}
