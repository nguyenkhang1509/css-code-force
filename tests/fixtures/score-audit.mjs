export const sampleCases = [
  {
    input: "5 3\n1 3 2\n2 5 1\n4 4 -3\n2 6 6 1 4\n",
    expected: "2 4\n",
    explanation: "The second adjustment was recorded as adding 1 point to students 2 through 5. The actual score difference shows it should have added 4 points.",
  },
  {
    input: "4 3\n1 4 4\n2 3 6\n2 3 2\n4 9 9 4\n",
    expected: "2 3\n",
    explanation: "Changing adjustment 2 from 6 to 3 works. Changing adjustment 3 from 2 to -1 also works, so choose the smaller index.",
  },
];

// Each fixture records the operation list and the one actual amount used to
// construct the final scores. The optimized oracle derives the expected answer
// independently and therefore handles duplicate-interval tie cases correctly.
export const smallSpecs = [
  { n: 1, operations: [[1, 1, 0]], wrongIndex: 0, actual: 4 },
  { n: 1, operations: [[1, 1, 5], [1, 1, -2], [1, 1, 0]], wrongIndex: 1, actual: -9 },
  { n: 8, operations: [[1, 8, -3]], wrongIndex: 0, actual: 10 },
  { n: 5, operations: [[1, 1, 9], [2, 5, 3]], wrongIndex: 0, actual: -1 },
  { n: 5, operations: [[1, 3, 4], [5, 5, 0]], wrongIndex: 1, actual: 4 },
  { n: 5, operations: [[1, 5, 4], [2, 4, -2], [1, 5, 1]], wrongIndex: 2, actual: 8 },
  { n: 7, operations: [[2, 6, 0]], wrongIndex: 0, actual: 9 },
  { n: 6, operations: [[3, 4, -4], [1, 6, 8]], wrongIndex: 0, actual: 0 },
  { n: 6, operations: [[1, 6, -5], [2, 4, -9], [4, 6, 3]], wrongIndex: 0, actual: -20 },
  { n: 4, operations: [[1, 4, 1_000_000_000]], wrongIndex: 0, actual: -1_000_000_000 },
  { n: 4, operations: [[2, 3, -1_000_000_000]], wrongIndex: 0, actual: 1_000_000_000 },
  { n: 3, operations: [[1, 2, 17]], wrongIndex: 0, actual: 1_000_000_000 },
  { n: 3, operations: [[2, 3, -17]], wrongIndex: 0, actual: -1_000_000_000 },
  { n: 2, operations: [[1, 2, 1_000_000_000], [1, 2, 1_000_000_000], [1, 2, 1_000_000_000]], wrongIndex: 1, actual: 999_999_999 },
  { n: 8, operations: [[1, 5, 3], [4, 8, -2], [2, 7, 8], [5, 6, -4]], wrongIndex: 2, actual: -11 },
  { n: 9, operations: [[1, 9, 4], [2, 8, -5], [4, 6, 9], [5, 5, -2]], wrongIndex: 1, actual: 12 },
  { n: 7, operations: [[1, 2, 3], [3, 5, -4], [6, 7, 8], [2, 6, 1]], wrongIndex: 1, actual: -10 },
  { n: 6, operations: [[2, 4, 0], [2, 4, 1], [2, 4, 2]], wrongIndex: 2, actual: 9 },
  { n: 4, operations: [[1, 2, 1_000_000_000], [1, 2, 0], [2, 3, 10]], wrongIndex: 1, actual: 20 },
  { n: 5, operations: [[2, 5, 100], [1, 3, -20], [2, 5, -7], [4, 5, 2]], wrongIndex: 2, actual: 3 },
  { n: 10, operations: [[1, 1, 4], [2, 2, -3], [5, 8, 0], [10, 10, 2]], wrongIndex: 3, actual: -9 },
  { n: 8, operations: [[1, 8, -1_000_000_000], [2, 7, -1_000_000_000], [3, 6, -1_000_000_000]], wrongIndex: 0, actual: -999_999_999 },
  { n: 7, operations: [[1, 7, 6], [1, 3, -4], [4, 7, 2], [2, 6, -8]], wrongIndex: 2, actual: -13 },
  { n: 5, operations: [[2, 2, 0], [1, 5, 0]], wrongIndex: 0, actual: -3 },
  { n: 5, operations: [[1, 5, -3], [1, 5, 11]], wrongIndex: 1, actual: 0 },
  { n: 6, operations: [[1, 3, 9], [2, 6, -4], [4, 6, 7], [1, 6, -2]], wrongIndex: 2, actual: -1_000_000_000 },
  { n: 3, operations: [[1, 1, -9], [2, 2, 12], [3, 3, -15]], wrongIndex: 0, actual: -1_000_000_000 },
  { n: 1, operations: [[1, 1, -1_000_000_000], [1, 1, 0]], wrongIndex: 0, actual: 1_000_000_000 },
  { n: 12, operations: [[1, 12, 0], [3, 10, 8], [6, 6, -5], [3, 10, -3]], wrongIndex: 3, actual: 0 },
];

export function buildInput(n, operations, finalScores) {
  return `${n} ${operations.length}\n${operations.map((op) => op.join(" ")).join("\n")}\n${finalScores.join(" ")}\n`;
}

function scoresFor(n, operations, wrongIndex, actual) {
  const diff = Array(n + 2).fill(0n);
  operations.forEach(([left, right, amount], index) => {
    const value = BigInt(index === wrongIndex ? actual : amount);
    diff[left] += value;
    diff[right + 1] -= value;
  });
  let current = 0n;
  return Array.from({ length: n }, (_, index) => {
    current += diff[index + 1];
    return current;
  });
}

export function buildSmallCases() {
  return smallSpecs.map((spec) => {
    const finalScores = scoresFor(spec.n, spec.operations, spec.wrongIndex, spec.actual);
    return { input: buildInput(spec.n, spec.operations, finalScores), finalScores };
  });
}

export function solveOptimized(input) {
  const values = input.trim().split(/\s+/).map(BigInt);
  let pos = 0;
  const n = Number(values[pos++]);
  const q = Number(values[pos++]);
  const operations = [];
  const diff = Array(n + 2).fill(0n);
  for (let i = 0; i < q; i++) {
    const left = Number(values[pos++]);
    const right = Number(values[pos++]);
    const amount = values[pos++];
    operations.push({ left, right, amount });
    diff[left] += amount;
    diff[right + 1] -= amount;
  }
  const actual = values.slice(pos, pos + n);
  const delta = Array(n + 1).fill(0n);
  let recorded = 0n;
  let first = 0;
  let last = 0;
  let correction = 0n;
  for (let i = 1; i <= n; i++) {
    recorded += diff[i];
    delta[i] = actual[i - 1] - recorded;
    if (delta[i] !== 0n) {
      if (!first) {
        first = i;
        correction = delta[i];
      }
      last = i;
    }
  }
  if (!first || correction === 0n) throw new Error("No valid correction interval");
  for (let i = 1; i <= n; i++) {
    if (delta[i] !== (i >= first && i <= last ? correction : 0n)) throw new Error("Invalid discrepancy pattern");
  }
  for (let i = 0; i < operations.length; i++) {
    const op = operations[i];
    if (op.left !== first || op.right !== last) continue;
    const corrected = op.amount + correction;
    if (corrected !== op.amount && corrected >= -1_000_000_000n && corrected <= 1_000_000_000n) {
      return `${i + 1} ${corrected}\n`;
    }
  }
  throw new Error("No valid operation found");
}

// Independent small-input oracle: apply every operation directly, then try
// replacing each operation in increasing order and compare every score.
export function solveBruteForce(input) {
  const values = input.trim().split(/\s+/).map(BigInt);
  let pos = 0;
  const n = Number(values[pos++]);
  const q = Number(values[pos++]);
  const operations = [];
  const recorded = Array(n).fill(0n);
  for (let i = 0; i < q; i++) {
    const left = Number(values[pos++]);
    const right = Number(values[pos++]);
    const amount = values[pos++];
    operations.push({ left, right, amount });
    for (let index = left - 1; index < right; index++) recorded[index] += amount;
  }
  const actual = values.slice(pos, pos + n);
  for (let opIndex = 0; opIndex < q; opIndex++) {
    const op = operations[opIndex];
    const delta = actual[op.left - 1] - recorded[op.left - 1];
    const corrected = op.amount + delta;
    if (delta === 0n || corrected < -1_000_000_000n || corrected > 1_000_000_000n) continue;
    let matches = true;
    for (let index = 0; index < n; index++) {
      const candidateScore = recorded[index] + (index >= op.left - 1 && index < op.right ? delta : 0n);
      if (candidateScore !== actual[index]) {
        matches = false;
        break;
      }
    }
    if (matches) return `${opIndex + 1} ${corrected}\n`;
  }
  throw new Error("No valid correction found by brute force");
}

export function buildLargeCase(kind) {
  const n = 200_000;
  const q = 200_000;
  const operations = new Array(q);
  let finalScores;
  let expected;
  if (kind === "repeated") {
    for (let i = 0; i < q; i++) operations[i] = [1, n, 0];
    finalScores = Array(n).fill(1n);
    expected = "1 1\n";
  } else if (kind === "random") {
    const diff = Array(n + 2).fill(0n);
    for (let i = 1; i < q; i++) {
      const left = ((i * 48_271 + 17) % (n - 1)) + 1;
      const right = left + ((i * 7_919 + 23) % (n - left + 1));
      const amount = ((i * 104_729 + 91) % 2_001) - 1_000;
      operations[i - 1] = [left, right, amount];
      diff[left] += BigInt(amount);
      diff[right + 1] -= BigInt(amount);
    }
    operations[q - 1] = [n, n, 7];
    diff[n] += -11n;
    diff[n + 1] -= -11n;
    finalScores = [];
    let score = 0n;
    for (let i = 1; i <= n; i++) {
      score += diff[i];
      finalScores.push(score);
    }
    expected = `${q} -11\n`;
  } else if (kind === "nested") {
    const diff = Array(n + 2).fill(0n);
    for (let i = 1; i <= q; i++) {
      const width = ((i - 1) % 100) + 1;
      const left = width;
      const right = n - width + 1;
      operations[i - 1] = [left, right, 0];
      if (i === q) {
        diff[left] -= 7n;
        diff[right + 1] += 7n;
      }
    }
    finalScores = [];
    let score = 0n;
    for (let i = 1; i <= n; i++) {
      score += diff[i];
      finalScores.push(score);
    }
    expected = "100 -7\n";
  } else {
    throw new Error(`Unknown large-case kind: ${kind}`);
  }
  return { input: buildInput(n, operations, finalScores), expected };
}

export function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0x1_0000_0000;
  };
}
