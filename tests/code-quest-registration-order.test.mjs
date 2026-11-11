import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  bruteForcePossible,
  formatInput,
  hiddenSmall,
  isStrictlyIncreasing,
  largeCase,
  samples,
  seededRandom,
  solveOptimized,
  validateOutput,
} from "./fixtures/registration-order.mjs";

test("the optimized reference solver matches all four public examples", () => {
  const outputs = ["yes\n3 5\n", "yes\n2 4\n", "no\n", "yes\n1 1\n"];
  samples.forEach(({ values }, index) => {
    const answer = solveOptimized(values);
    assert.equal(answer.possible, outputs[index].startsWith("yes"));
    assert.equal(validateOutput(values, outputs[index]), true);
  });
});

test("optimized feasibility agrees with all-segment brute force on 1,000 seeded permutations", () => {
  const random = seededRandom(0x51A7_2026);
  for (let trial = 0; trial < 1_000; trial++) {
    const n = 1 + Math.floor(random() * 10);
    const values = Array.from({ length: n }, (_, i) => i + 1);
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [values[i], values[j]] = [values[j], values[i]];
    }
    assert.equal(solveOptimized(values).possible, bruteForcePossible(values), `case ${trial + 1}: ${formatInput(values)}`);
  }
});

test("custom answer validation accepts any valid segment and rejects malformed or false claims", () => {
  const sorted = [1, 2, 3, 4, 5];
  assert.equal(validateOutput(sorted, "yes\n3 3\n"), true);
  assert.equal(validateOutput(sorted, "yes 1 1"), true);
  assert.equal(validateOutput(sorted, "no"), false);
  assert.equal(validateOutput(sorted, "yes 0 1"), false);
  assert.equal(validateOutput(sorted, "yes 1 6"), false);
  assert.equal(validateOutput(sorted, "yes 1 3 extra"), false);
  assert.equal(validateOutput(sorted, "yes 1.0 1"), false);
  assert.equal(validateOutput(sorted, "YES 1 1"), false);
  assert.equal(validateOutput(sorted, "yes 1_0 1"), false);
  assert.equal(validateOutput([1, 3, 2, 4], "yes 2 3"), true);
  assert.equal(validateOutput([1, 3, 2, 4], "yes 1 2"), false);
  assert.equal(validateOutput([1, 3, 2, 5, 4, 6], "no"), true);
  assert.equal(validateOutput([1, 3, 2, 5, 4, 6], "yes 1 6"), false);
  assert.equal(validateOutput([4, 2, 3, 1, 5], "yes 2 4"), false);
});

test("all required maximum-size input patterns have the expected feasibility", () => {
  assert.deepEqual(solveOptimized(largeCase("sorted")), { possible: true, left: 1, right: 1 });
  assert.deepEqual(solveOptimized(largeCase("reversed")), { possible: true, left: 1, right: 100_000 });
  assert.deepEqual(solveOptimized(largeCase("one-reversed-segment")), { possible: true, left: 25_001, right: 75_000 });
  assert.equal(solveOptimized(largeCase("two-swaps")).possible, false);
  assert.equal(solveOptimized(largeCase("affine-permutation")).possible, false);
});

test("the seed places an untagged 40-case problem in Code Quest with a private custom checker", async () => {
  const migration = await readFile(new URL("../supabase/migrations/202611100005_registration_order.sql", import.meta.url), "utf8");
  assert.match(migration, /Code Quest Tryouts: Registration Order/);
  assert.match(migration, /'Code Quest Tryout'[\s,\n]+\s*'Easy'/);
  assert.match(migration, /'code-quest-tryouts-registration-order'/);
  assert.match(migration, /40 official test cases: four public examples, 31 small hidden cases, and five large hidden cases/i);
  assert.match(migration, /delete from public\.problem_tags where problem_id\s*=\s*v_problem_id/i);
  assert.match(migration, /problem_judge_configs/);
  assert.match(migration, /single_reverse_segment/);
  assert.match(migration, /published=false/i);
});

test("judge routes load the private output checker, while exact comparison stays the default", async () => {
  const [runRoute, submitRoute, judge] = await Promise.all([
    readFile(new URL("../app/api/run/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/submit/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/judge/vercel-sandbox.ts", import.meta.url), "utf8"),
  ]);
  assert.match(runRoute, /problem_judge_configs/);
  assert.match(submitRoute, /problem_judge_configs/);
  assert.match(judge, /output_checker/);
  assert.match(judge, /single_reverse_segment/);
  assert.match(judge, /normalize\(actual\) != normalize\(test\["expected_output"\]\)/);
});

test("all generated official sample and hidden lists contain distinct registration IDs", () => {
  const allSmallValues = [...samples.map((sample) => sample.values), ...hiddenSmall];
  for (const values of allSmallValues) {
    assert.equal(new Set(values).size, values.length, formatInput(values));
    assert.ok(values.every((value) => value >= 1 && value <= 1_000_000_000));
  }
  for (const kind of ["sorted", "reversed", "one-reversed-segment", "two-swaps", "affine-permutation"]) {
    const values = largeCase(kind);
    assert.equal(new Set(values).size, 100_000, kind);
  }
});
