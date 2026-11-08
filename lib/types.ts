export type Difficulty = "Easy" | "Medium" | "Hard";
export type Language = "python" | "cpp";
export type Verdict = "Pending" | "Accepted" | "Wrong Answer" | "Time Limit Exceeded" | "Memory Limit Exceeded" | "Runtime Error" | "Compilation Error" | "Judging Error";

export type Problem = {
  id: string;
  slug: string;
  title: string;
  difficulty: Difficulty;
  statement: string;
  input_format: string;
  output_format: string;
  constraints: string;
  tags: string[];
  time_limit_ms: number;
  memory_limit_mb: number;
  created_at: string;
  published: boolean;
};

export type TestCase = { id?: string; input: string; expected_output: string; is_sample: boolean; explanation?: string | null };
export type JudgeResult = { submissionId?: string; verdict: Verdict; message?: string; errorMessage?: string | null; executionTimeMs?: number | null; cases?: Array<{ index: number; passed: boolean; input?: string; expectedOutput?: string; actualOutput?: string; executionTimeMs?: number; message?: string }> };

export const STARTER_CODE: Record<Language, string> = {
  python: "import sys\n\ndef solve():\n    data = sys.stdin.read().strip().split()\n    # Write your solution here\n\nif __name__ == \"__main__\":\n    solve()\n",
  cpp: "#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    ios::sync_with_stdio(false);\n    cin.tie(nullptr);\n    // Write your solution here\n    return 0;\n}\n",
};
