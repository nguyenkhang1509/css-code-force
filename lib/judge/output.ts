export const MAX_SOURCE_BYTES = 65_536;
export const MAX_INPUT_BYTES = 3_145_728;
export const MAX_OUTPUT_BYTES = 2_097_152;
export const MAX_TOTAL_TEST_BYTES = 4_194_304;
export const MAX_DIAGNOSTIC_CHARS = 4_000;

export function normalizeOutput(output: string) {
  return output.replace(/\r\n?/g, "\n").split("\n").map(line => line.replace(/[\t ]+$/g, "")).join("\n").replace(/\n+$/g, "");
}

export function truncate(value: string, limit = MAX_DIAGNOSTIC_CHARS) {
  return value.length > limit ? `${value.slice(0, limit)}\n…output truncated…` : value;
}

const SAFE_JUDGE_FAILURE_PREFIXES = [
  "The isolated runner did not start within ",
  "The configured judge snapshot is expired or unavailable ",
  "Vercel could not start the judge sandbox.",
  "The isolated runner could not receive ",
  "Preparing the C++ compiler exceeded ",
  "C++ compilation exceeded ",
  "Python compilation exceeded ",
  "The sandbox could not disable network access ",
  "The configured judge snapshot does not contain g++.",
  "The isolated runner exceeded its ",
  "The isolated runner exceeded its platform time budget",
  "The isolated runner could not return its result ",
  "The isolated runner stopped before returning a result ",
  "This problem does not have any public sample tests yet.",
  "This problem does not have judge test cases configured.",
];

export function publicJudgeFailure(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (SAFE_JUDGE_FAILURE_PREFIXES.some(prefix => message.startsWith(prefix))) return truncate(message, 500);
  return "The judge service could not complete this run. Your code was not marked Accepted. Please retry in a moment.";
}
