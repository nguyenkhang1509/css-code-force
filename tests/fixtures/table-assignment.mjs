export const samples = [
  {
    groups: [1, 2, 4, 3, 3],
    expected: 4,
    explanation: "One group of three shares with the group of one. The other group of three, the group of four, and the group of two each need their own table.",
  },
  {
    groups: [2, 3, 4, 4, 2, 1, 3, 1],
    expected: 5,
    explanation: null,
  },
];

// The first two fixtures are the public examples. The rest cover edge and
// packing cases; the seed migration generates their expected answers itself.
export const smallCases = [
  samples[0],
  samples[1],
  { groups: [1] },
  { groups: [2] },
  { groups: [3] },
  { groups: [4] },
  { groups: [1, 3] },
  { groups: [1, 4] },
  { groups: [1, 1, 1, 1, 1] },
  { groups: [2, 2, 2, 2, 2] },
  { groups: [3, 3, 3, 3, 3] },
  { groups: [4, 4, 4, 4, 4] },
  { groups: [3, 3, 1, 3, 1] },
  { groups: [3, 3, 3, 1] },
  { groups: [1, 1, 1, 1, 1, 1, 3] },
  { groups: [2, 2, 2, 2, 2, 2] },
  { groups: [2, 2, 2, 1, 1, 1, 1] },
  { groups: [1, 1, 1, 1, 1, 1, 1, 1, 1] },
  { groups: [1, 2, 3, 4, 1, 2, 3, 4] },
  { groups: [3, 2, 3] },
  { groups: [1, 1, 3] },
  { groups: [1, 1, 1, 3] },
  { groups: [2, 2, 1, 1, 1] },
  { groups: [2, 1, 1] },
  { groups: [4, 1, 1, 1, 1] },
  { groups: [3, 3, 1, 1, 1, 1, 1] },
];

export function solveGreedy(groups) {
  let ones = 0;
  let twos = 0;
  let threes = 0;
  let fours = 0;
  for (const size of groups) {
    if (size === 1) ones++;
    else if (size === 2) twos++;
    else if (size === 3) threes++;
    else if (size === 4) fours++;
    else throw new Error(`Invalid group size: ${size}`);
  }

  let tables = fours + threes;
  ones = Math.max(0, ones - threes);
  tables += Math.floor(twos / 2);
  if (twos % 2) {
    tables++;
    ones = Math.max(0, ones - 2);
  }
  tables += Math.floor((ones + 3) / 4);
  return tables;
}

// Exact bin-packing search for small arrays. It tries every distinct remaining
// capacity and opens a new table only when necessary.
export function solveBruteForce(groups) {
  const items = [...groups].sort((a, b) => b - a);
  let best = items.length;

  function search(index, freeSeats) {
    if (freeSeats.length >= best) return;
    if (index === items.length) {
      best = freeSeats.length;
      return;
    }

    const size = items[index];
    const seenCapacities = new Set();
    for (let table = 0; table < freeSeats.length; table++) {
      const capacity = freeSeats[table];
      if (capacity < size || seenCapacities.has(capacity)) continue;
      seenCapacities.add(capacity);
      freeSeats[table] -= size;
      search(index + 1, freeSeats);
      freeSeats[table] += size;
    }

    if (freeSeats.length + 1 < best) {
      freeSeats.push(4 - size);
      search(index + 1, freeSeats);
      freeSeats.pop();
    }
  }

  search(0, []);
  return best;
}

export function makeInput(groups) {
  return `${groups.length}\n${groups.join(" ")}\n`;
}

export function buildLargeGroups(kind, n = 100_000) {
  if (kind === "ones") return Array(n).fill(1);
  if (kind === "fours") return Array(n).fill(4);
  if (kind === "ones-threes") return Array.from({ length: n }, (_, i) => (i % 2 === 0 ? 1 : 3));
  if (kind === "twos-threes") return Array.from({ length: n }, (_, i) => (i % 2 === 0 ? 2 : 3));
  if (kind === "random") return Array.from({ length: n }, (_, i) => ((i * 48_271 + 17) % 4) + 1);
  throw new Error(`Unknown table-assignment test kind: ${kind}`);
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
