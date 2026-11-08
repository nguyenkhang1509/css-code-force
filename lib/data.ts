import { createClient } from "@/lib/supabase/server";

export async function getPublishedProblems() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("problems").select("*,problem_tags(tag)").eq("published", true).order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(problem => ({ ...problem, tags: (problem.problem_tags ?? []).map((tag: {tag:string}) => tag.tag) }));
}

export async function getSolvedProblemIds(userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("user_problem_progress").select("problem_id").eq("user_id", userId);
  if (error) throw error;
  return new Set((data ?? []).map(row => row.problem_id));
}
