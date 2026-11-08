import type { Metadata } from "next";
import { ProblemTable } from "@/components/problem-table";
import { getPublishedProblems, getSolvedProblemIds } from "@/lib/data";
import { getViewer } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title:"Problems" };

export default async function ProblemsPage() {
  let problems: Awaited<ReturnType<typeof getPublishedProblems>> = [];
  let error = "";
  try { problems = await getPublishedProblems(); } catch (cause) { error = cause instanceof Error ? cause.message : "Could not load the problem list."; }
  let solved = new Set<string>();
  try { const viewer = await getViewer(); if (viewer) solved = await getSolvedProblemIds(viewer.user.id); } catch { /* Anonymous or not configured yet. */ }
  const list = problems.map(problem => ({ ...problem, solved:solved.has(problem.id) }));
  return <section className="container section"><div style={{ marginBottom:24 }}><div className="eyebrow">Practice arena</div><h1 className="page-heading">Problems</h1><p className="page-subtitle">Choose a challenge, work through it in your browser, and learn from every attempt.</p></div>{error && <div className="alert" style={{ marginBottom:16 }}>Could not load problems. Apply the database migration and check the Supabase environment variables.</div>}<ProblemTable problems={list as never} /></section>;
}
