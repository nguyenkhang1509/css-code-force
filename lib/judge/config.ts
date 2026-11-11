import type { OutputChecker } from "@/lib/judge/types";

export function getOutputChecker(config: { output_checker: string } | null, error: { code?: string } | null): OutputChecker {
  // Allow existing exact-output problems to keep working if the optional
  // checker-config migration has not reached a deployment yet.
  if (error && error.code !== "42P01" && error.code !== "PGRST205") {
    throw new Error("Could not load the private checker configuration.");
  }
  return config?.output_checker === "single_reverse_segment" ? "single_reverse_segment" : "exact";
}
