import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sampleOne = ["6", "8 3 5 3 10 6", "4", "1 2 5", "2 2 4", "1 1 6", "2 5 6", ""].join("\n");
const sampleTwo = ["4", "5 5 2 3", "4", "1 2 4", "2 1 3", "1 1 1", "2 2 4", ""].join("\n");

function parse(input) {
  const tokens = input.trim().split(/\s+/).map(Number);
  let position = 0;
  const n = tokens[position++];
  const scores = tokens.slice(position, position + n);
  position += n;
  const q = tokens[position++];
  const queries = [];
  for (let i = 0; i < q; i++) {
    queries.push(tokens.slice(position, position + 3));
    position += 3;
  }
  assert.equal(position, tokens.length, "input must not have trailing tokens");
  return { scores, queries };
}

function answerWithPrefix(scores, queries, forcedOrder = "byType", omitLeftPrefix = false) {
  const sorted = [...scores].sort((a, b) => a - b);
  const prefix = values => {
    const result = [0];
    for (const value of values) result.push(result.at(-1) + value);
    return result;
  };
  const originalPrefix = prefix(scores);
  const sortedPrefix = prefix(sorted);
  return queries.map(([type, left, right]) => {
    const useOriginal = forcedOrder === "original" || (forcedOrder === "byType" && type === 1);
    const values = useOriginal ? originalPrefix : sortedPrefix;
    return values[right] - values[omitLeftPrefix ? left : left - 1];
  });
}

function optimized(input) {
  const { scores, queries } = parse(input);
  return answerWithPrefix(scores, queries).join("\n") + "\n";
}

function bruteForce(input) {
  const { scores, queries } = parse(input);
  const sorted = [...scores].sort((a, b) => a - b);
  return queries.map(([type, left, right]) => {
    const values = type === 1 ? scores : sorted;
    let sum = 0;
    for (let i = left - 1; i < right; i++) sum += values[i];
    return sum;
  }).join("\n") + "\n";
}

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

function buildPerformanceFixture() {
  const n = 100_000;
  const q = 100_000;
  const scores = Array.from({ length: n }, (_, index) => {
    const i = index + 1;
    return (i * 48_271 + 12_345) % 1_000_000_000 + 1;
  });
  const sorted = [...scores].sort((a, b) => a - b);
  const originalPrefix = [0];
  const sortedPrefix = [0];
  for (let i = 0; i < n; i++) {
    originalPrefix.push(originalPrefix[i] + scores[i]);
    sortedPrefix.push(sortedPrefix[i] + sorted[i]);
  }
  const queries = [];
  const answers = [];
  for (let index = 1; index <= q; index++) {
    const type = index % 2 === 1 ? 1 : 2;
    const fullRange = index % 4 === 1 || index % 4 === 2;
    const left = fullRange ? 1 : ((index * 7_919) % n) + 1;
    const right = fullRange ? n : Math.min(n, left + (index % 2));
    const prefix = type === 1 ? originalPrefix : sortedPrefix;
    queries.push(type + " " + left + " " + right);
    answers.push(String(prefix[right] - prefix[left - 1]));
  }
  return {
    input: n + "\n" + scores.join(" ") + "\n" + q + "\n" + queries.join("\n") + "\n",
    expected: answers.join("\n") + "\n",
  };
}

test("the two official public examples have their stated output", () => {
  assert.equal(optimized(sampleOne), "21\n14\n35\n18\n");
  assert.equal(optimized(sampleTwo), "10\n10\n5\n13\n");
});

test("prefix sums agree with an independent brute-force implementation on 500 randomized inputs", () => {
  const random = seededRandom(0xC55_2026);
  for (let sample = 0; sample < 500; sample++) {
    const n = 1 + Math.floor(random() * 30);
    const q = 1 + Math.floor(random() * 40);
    const scores = Array.from({ length: n }, () => 1 + Math.floor(random() * 1_000_000_000));
    const queries = Array.from({ length: q }, () => {
      const left = 1 + Math.floor(random() * n);
      const right = left + Math.floor(random() * (n - left + 1));
      return [1 + Math.floor(random() * 2), left, right];
    });
    const input = n + "\n" + scores.join(" ") + "\n" + q + "\n" + queries.map(query => query.join(" ")).join("\n") + "\n";
    assert.equal(optimized(input), bruteForce(input), "randomized input " + (sample + 1));
  }
});

test("the fixture set includes 30 official cases and both sample cases", async () => {
  const seed = await readFile(new URL("../supabase/migrations/202611090001_css_practice_statistics.sql", import.meta.url), "utf8");
  const smallCases = seed.match(/^\(\d+,'\{/gm) ?? [];
  assert.equal(smallCases.length, 29);
  assert.match(seed, /\),29,/);
  assert.match(seed, /\(0,'\{8,3,5,3,10,6\}'.*true\)/);
  assert.match(seed, /\(1,'\{5,5,2,3\}'.*true\)/);
});

test("the generated stress input fits Vercel limits and combines 100,000 full-range and short-range queries", () => {
  const fixture = buildPerformanceFixture();
  assert.equal(fixture.expected.trimEnd().split("\n").length, 100_000);
  assert.ok(Buffer.byteLength(fixture.input) < 3 * 1024 * 1024);
  assert.ok(Buffer.byteLength(fixture.expected) < 2 * 1024 * 1024);
  assert.ok(Buffer.byteLength(fixture.input) + Buffer.byteLength(fixture.expected) < 4 * 1024 * 1024 - 64_000,
    "leave room for the remaining 29 small tests below the database's 4 MB cap");
  const requestBytes = Buffer.byteLength(JSON.stringify({ test_cases: [fixture] }));
  assert.ok(requestBytes < 4_500_000 - 64_000, "leave room for metadata below Vercel's 4.5 MB function request limit");
  assert.equal(100_000 * 100_000, 10_000_000_000, "a scan of every range per query requires 10 billion element visits");
});

test("incorrect query-type, range-boundary, and 32-bit implementations disagree on designed cases", () => {
  const { scores, queries } = parse(sampleOne);
  const correct = answerWithPrefix(scores, queries);
  const alwaysOriginal = answerWithPrefix(scores, queries, "original");
  const alwaysSorted = answerWithPrefix(scores, queries, "sorted");
  const offByOne = answerWithPrefix(scores, queries, "byType", true);
  assert.notDeepEqual(alwaysOriginal, correct);
  assert.notDeepEqual(alwaysSorted, correct);
  assert.notDeepEqual(offByOne, correct);

  const large = [1_000_000_000, 1_000_000_000, 1_000_000_000];
  const sum = large.reduce((total, value) => total + value, 0);
  assert.equal(sum, 3_000_000_000);
  assert.notEqual(sum | 0, sum, "signed 32-bit C++ arithmetic must overflow");
});
