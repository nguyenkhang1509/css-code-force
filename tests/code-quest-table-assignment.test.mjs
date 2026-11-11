import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  buildLargeGroups,
  makeInput,
  samples,
  seededRandom,
  smallCases,
  solveBruteForce,
  solveGreedy,
} from "./fixtures/table-assignment.mjs";

test("both public examples return their stated table counts", () => {
  assert.equal(solveGreedy(samples[0].groups), 4);
  assert.equal(solveGreedy(samples[1].groups), 5);
});

test("small fixed fixtures agree with exhaustive table assignment", () => {
  assert.equal(smallCases.length, 26);
  for (const fixture of smallCases) {
    assert.equal(solveGreedy(fixture.groups), solveBruteForce(fixture.groups), makeInput(fixture.groups));
  }
});

test("greedy solver agrees with brute force on 1,000 deterministic random inputs", () => {
  const random = seededRandom(0xC0DE_2026);
  for (let trial = 0; trial < 1_000; trial++) {
    const n = 1 + Math.floor(random() * 10);
    const groups = Array.from({ length: n }, () => 1 + Math.floor(random() * 4));
    assert.equal(solveGreedy(groups), solveBruteForce(groups), `random case ${trial + 1}: ${makeInput(groups)}`);
  }
});

test("maximum-size arrays and seeded random data have the expected greedy counts", () => {
  assert.equal(solveGreedy(buildLargeGroups("ones")), 25_000);
  assert.equal(solveGreedy(buildLargeGroups("fours")), 100_000);
  assert.equal(solveGreedy(buildLargeGroups("ones-threes")), 50_000);
  assert.equal(solveGreedy(buildLargeGroups("twos-threes")), 75_000);
  const randomGroups = buildLargeGroups("random");
  assert.equal(randomGroups.length, 100_000);
  assert.ok(Buffer.byteLength(makeInput(randomGroups)) < 300_000);
});

test("database seed uses the Code Quest section, has no tags, and keeps only the two examples public", async () => {
  const migration = await readFile(new URL("../supabase/migrations/202611100002_table_assignment.sql", import.meta.url), "utf8");
  assert.match(migration, /Code Quest Tryouts: Table Assignment/);
  assert.match(migration, /'Code Quest Tryout'[\s,\n]+\s*'Easy'/);
  assert.match(migration, /'code-quest-tryouts-table-assignment'/);
  assert.match(migration, /2 public samples and 29 hidden cases/i);
  assert.match(migration, /published=false/i);
  assert.match(migration, /delete from public\.problem_tags where problem_id\s*=\s*v_problem_id/i);
  assert.match(migration, /true, 'The group of size 1 shares a table/i);
  assert.match(migration, /case_index,\s*kind/i);
  assert.match(migration, /generate_series\(1,\s*100000\)/i);
});

test("leaderboard migration counts unique attempted and accepted problem IDs", async () => {
  const migration = await readFile(new URL("../supabase/migrations/202611100003_unique_leaderboard_attempts.sql", import.meta.url), "utf8");
  assert.match(migration, /count\(distinct s\.problem_id\)::bigint as attempted_count/i);
  assert.match(migration, /count\(distinct s\.problem_id\) filter\s*\(where s\.verdict = 'Accepted'\)::bigint as accepted_count/i);
  assert.match(migration, /insert into public\.user_problem_progress/i);
  assert.match(migration, /on conflict\s*\(user_id,\s*problem_id\) do update/i);
});
