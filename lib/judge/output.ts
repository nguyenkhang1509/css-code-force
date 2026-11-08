export const MAX_SOURCE_BYTES = 65_536;
export const MAX_INPUT_BYTES = 65_536;
export const MAX_OUTPUT_BYTES = 524_288;
export const MAX_DIAGNOSTIC_CHARS = 4_000;

export function normalizeOutput(output: string) {
  return output.replace(/\r\n?/g, "\n").split("\n").map(line => line.replace(/[\t ]+$/g, "")).join("\n").replace(/\n+$/g, "");
}

export function truncate(value: string, limit = MAX_DIAGNOSTIC_CHARS) {
  return value.length > limit ? `${value.slice(0, limit)}\n…output truncated…` : value;
}
