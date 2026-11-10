import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  buildLargeCase,
  buildInput,
  buildSmallCases,
  sampleCases,
  seededRandom,
  smallSpecs,
  solveBruteForce,
  solveOptimized,
} from "./fixtures/score-audit.mjs";

test("both public examples produce their stated answer", () => {
  assert.equal(solveOptimized(sampleCases[0].input), "2 4\n");
  assert.equal(solveOptimized(sampleCases[1].input), "2 3\n");
});

test("the 29 small hidden fixtures agree with the independent brute-force solver", () => {
  const fixtures = buildSmallCases();
  assert.equal(fixtures.length, 29);
  for (const fixture of fixtures) {
    assert.equal(solveOptimized(fixture.input), solveBruteForce(fixture.input));
  }
  assert.ok(fixtures.flatMap((fixture) => fixture.finalScores).some((score) => score > 2_147_483_647n));
  assert.ok(fixtures.flatMap((fixture) => fixture.finalScores).some((score) => score < -2_147_483_648n));
});

test("optimized solver matches brute force on 1,000 deterministic randomized valid cases", () => {
  const random = seededRandom(0xC0DE_2026);
  for (let sample = 0; sample < 1_000; sample++) {
    const n = 1 + Math.floor(random() * 12);
    const q = 1 + Math.floor(random() * 12);
    const operations = Array.from({ length: q }, () => {
      const left = 1 + Math.floor(random() * n);
      const right = left + Math.floor(random() * (n - left + 1));
      const amount = Math.floor(random() * 41) - 20;
      return [left, right, amount];
    });
    const wrongIndex = Math.floor(random() * q);
    const recorded = operations[wrongIndex][2];
    const actual = recorded + 1 + Math.floor(random() * 20);
    const diff = Array(n + 2).fill(0n);
    operations.forEach(([left, right, amount], index) => {
      const value = BigInt(index === wrongIndex ? actual : amount);
      diff[left] += value;
      diff[right + 1] -= value;
    });
    let score = 0n;
    const finalScores = Array.from({ length: n }, (_, index) => (score += diff[index + 1]));
    const input = `${n} ${q}\n${operations.map((operation) => operation.join(" ")).join("\n")}\n${finalScores.join(" ")}\n`;
    assert.equal(solveOptimized(input), solveBruteForce(input), `generated case ${sample + 1}`);
  }
});

test("earliest-valid-operation tie breaking and 64-bit scores are covered", () => {
  const fixtures = buildSmallCases();
  assert.equal(solveOptimized(fixtures[17].input), "1 7\n");
  assert.equal(solveOptimized(fixtures[18].input), "2 20\n");
  assert.equal(solveOptimized(fixtures[13].input), "1 999999999\n");
  assert.equal(solveOptimized(fixtures[21].input), "1 -999999999\n");
});

test("three deterministic performance fixtures cover maximum n and q", () => {
  const repeated = buildLargeCase("repeated");
  assert.equal(solveOptimized(repeated.input), "1 1\n");
  assert.ok(Buffer.byteLength(repeated.input) < 8 * 1024 * 1024);

  const random = buildLargeCase("random");
  assert.equal(solveOptimized(random.input), "200000 -11\n");
  assert.ok(Buffer.byteLength(random.input) < 8 * 1024 * 1024);

  const nested = buildLargeCase("nested");
  assert.equal(solveOptimized(nested.input), "100 -7\n");
  assert.ok(Buffer.byteLength(nested.input) < 8 * 1024 * 1024);

  const totalBytes = [repeated, random, nested].reduce((sum, fixture) => sum + Buffer.byteLength(fixture.input) + Buffer.byteLength(fixture.expected), 0);
  assert.ok(totalBytes < 16 * 1024 * 1024, `performance test data is ${totalBytes} bytes`);
});

test("the SQL seed keeps both samples public, all hidden cases private, and solutions unpublished", async () => {
  const migration = await readFile(new URL("../supabase/migrations/202611100001_code_quest_tryout_score_audit.sql", import.meta.url), "utf8");
  assert.match(migration, /Code Quest Tryouts: Score Audit/);
  assert.match(migration, /\(0,5,'\[\[1,3,2\],\[2,5,1\],\[4,4,-3\]\]'::jsonb,2,4::bigint,true,/);
  assert.match(migration, /published\s*=\s*false/i);
  assert.match(migration, /Code Quest Tryout/);
  assert.match(migration, /select\s+p\.id,33/i);
  assert.match(migration, /generate_series\(1,\s*200000\)/i);

  const seededFixtures = [...migration.matchAll(/^\s*\((\d+),(\d+),'(\[\[.*\]\])'::jsonb,(\d+),(-?\d+)::bigint,(true|false),/gm)];
  assert.equal(seededFixtures.length, 31, "two public examples and 29 small hidden cases are seeded");
  assert.equal(seededFixtures.filter((match) => match[6] === "true").length, 2);
  for (const match of seededFixtures) {
    const [, , nText, operationsText, wrongIndexText, correctedText] = match;
    const n = Number(nText);
    const operations = JSON.parse(operationsText);
    const wrongIndex = Number(wrongIndexText);
    const corrected = BigInt(correctedText);
    const finalScores = Array(n).fill(0n);
    operations.forEach(([left, right, recorded], index) => {
      const amount = index + 1 === wrongIndex ? corrected : BigInt(recorded);
      for (let position = left - 1; position < right; position++) finalScores[position] += amount;
    });
    const input = buildInput(n, operations, finalScores);
    assert.equal(solveOptimized(input), solveBruteForce(input), `database case ${match[1]}`);
  }
});
