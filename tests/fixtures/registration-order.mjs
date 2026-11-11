export const samples = [
  { values: [2, 5, 9, 8, 7, 12], expected: "yes\n3 5\n" },
  { values: [1, 7, 4, 3, 10], expected: "yes\n2 4\n" },
  { values: [4, 2, 3, 1, 5], expected: "no\n" },
  { values: [3, 6, 9, 12], expected: "yes\n1 1\n" },
];

export const hiddenSmall = [
  [1],
  [2, 1],
  [1, 2],
  [3, 2, 1],
  [1, 3, 2, 4],
  [4, 3, 2, 1],
  [2, 6, 5, 4, 3, 7],
  [6, 5, 4, 3, 2, 1],
  [2, 1, 3, 4],
  [1, 2, 4, 3],
  [10, 20, 15, 25],
  [8, 6, 7, 5, 3, 1],
  [1_000_000_000, 999_999_999, 999_999_998],
  [1, 1_000_000_000, 5],
  [2, 4, 3, 1, 5],
  [1, 5, 4, 6, 3, 7],
  [12, 9, 7, 3, 1],
  [5, 1, 2, 3, 4],
  [1, 2, 6, 5, 4, 3, 7, 8],
  [1, 3, 2, 5, 4, 6],
  [100, 1, 2, 3],
  [1, 2, 3, 4, 5, 6, 7],
  [9, 8, 7, 6, 5, 4, 3],
  [1, 2, 3, 9, 8, 7, 6, 10],
  [1, 4, 5, 2, 3, 6, 7],
  [999_999_997, 999_999_999, 999_999_998, 1_000_000_000],
  [2, 1, 4, 3, 6, 5],
  [1, 9, 8, 7, 6, 5, 10, 11],
  [2, 3, 1, 4],
  [1, 4, 3, 2, 5, 7, 6, 8],
  [7, 2, 5, 3, 6, 1, 4],
];

export function isStrictlyIncreasing(values) {
  for (let i = 1; i < values.length; i++) {
    if (values[i - 1] >= values[i]) return false;
  }
  return true;
}

export function solveOptimized(values) {
  const sorted = [...values].sort((a, b) => a - b);
  let left = 0;
  while (left < values.length && values[left] === sorted[left]) left++;
  if (left === values.length) return { possible: true, left: 1, right: 1 };

  let right = values.length - 1;
  while (values[right] === sorted[right]) right--;
  const reversed = [...values];
  for (let i = left, j = right; i < j; i++, j--) {
    [reversed[i], reversed[j]] = [reversed[j], reversed[i]];
  }
  return isStrictlyIncreasing(reversed)
    ? { possible: true, left: left + 1, right: right + 1 }
    : { possible: false };
}

export function bruteForcePossible(values) {
  for (let left = 0; left < values.length; left++) {
    for (let right = left; right < values.length; right++) {
      const candidate = [...values];
      for (let i = left, j = right; i < j; i++, j--) {
        [candidate[i], candidate[j]] = [candidate[j], candidate[i]];
      }
      if (isStrictlyIncreasing(candidate)) return true;
    }
  }
  return false;
}

export function formatInput(values) {
  return `${values.length}\n${values.join(" ")}\n`;
}

export function validateOutput(values, output) {
  const tokens = output.trim().split(/\s+/).filter(Boolean);
  if (tokens[0] === "no") return tokens.length === 1 && !bruteForcePossible(values);
  if (tokens[0] !== "yes" || tokens.length !== 3) return false;
  if (!/^[+-]?\d+$/.test(tokens[1]) || !/^[+-]?\d+$/.test(tokens[2])) return false;

  const left = Number(tokens[1]);
  const right = Number(tokens[2]);
  if (!Number.isSafeInteger(left) || !Number.isSafeInteger(right)) return false;
  if (left < 1 || right < left || right > values.length) return false;
  const candidate = [...values];
  for (let i = left - 1, j = right - 1; i < j; i++, j--) {
    [candidate[i], candidate[j]] = [candidate[j], candidate[i]];
  }
  return isStrictlyIncreasing(candidate);
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

export function largeCase(kind, n = 100_000) {
  if (kind === "sorted") return Array.from({ length: n }, (_, i) => i + 1);
  if (kind === "reversed") return Array.from({ length: n }, (_, i) => n - i);
  if (kind === "one-reversed-segment") {
    const left = Math.floor(n / 4);
    const right = Math.floor((3 * n) / 4) - 1;
    return Array.from({ length: n }, (_, i) => i >= left && i <= right ? left + right - i + 1 : i + 1);
  }
  if (kind === "two-swaps") {
    return Array.from({ length: n }, (_, i) => {
      const position = i + 1;
      if (position === 25_000) return 25_001;
      if (position === 25_001) return 25_000;
      if (position === 75_000) return 75_001;
      if (position === 75_001) return 75_000;
      return position;
    });
  }
  if (kind === "affine-permutation") {
    return Array.from({ length: n }, (_, i) => ((i * 48_271 + 17) % n) + 1);
  }
  throw new Error(`Unknown registration-order case: ${kind}`);
}
