import type { Metadata } from "next";
import { ProblemTable } from "@/components/problem-table";
import { getPublishedProblems, getSolvedProblemIds } from "@/lib/data";
import { getViewer } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Code Quest Tryout" };

export default async function CodeQuestTryoutPage() {
  let problems: Awaited<ReturnType<typeof getPublishedProblems>> = [];
  let error = "";
  try {
    problems = await getPublishedProblems("Code Quest Tryout");
  } catch (cause) {
    error = cause instanceof Error ? cause.message : "Could not load the Code Quest tryout problems.";
  }

  let solved = new Set<string>();
  try {
    const viewer = await getViewer();
    if (viewer) solved = await getSolvedProblemIds(viewer.user.id);
  } catch {
    // Anonymous visitors can still browse and read the problems.
  }

  const list = problems.map((problem) => ({ ...problem, solved: solved.has(problem.id) }));
  return (
    <section className="container section">
      <div style={{ marginBottom: 24 }}>
        <div className="eyebrow">Competition practice</div>
        <h1 className="page-heading">Code Quest Tryout</h1>
        <p className="page-subtitle">Practice problems prepared for the Lockheed Martin Code Quest tryouts.</p>
      </div>
      {error && <div className="alert" style={{ marginBottom: 16 }}>Could not load tryout problems. Apply the latest Supabase migration and refresh.</div>}
      <ProblemTable problems={list} showTopics={false} />
    </section>
  );
}
