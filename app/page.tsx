import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Braces, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Problem } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let problems: (Problem & {problem_tags?:Array<{tag:string}>})[] = [];
  let stats: {problems:number;submissions:number;accepted:number}|null = null;
  let setupError = "";
  try {
    const supabase = await createClient();
    const { data } = await supabase.from("problems").select("*,problem_tags(tag)").eq("published",true).order("created_at",{ascending:false}).limit(4);
    problems = data ?? [];
    const admin = createAdminClient();
    const [problemCount,submissionCount,acceptedCount] = await Promise.all([
      admin.from("problems").select("id",{count:"exact",head:true}).eq("published",true),
      admin.from("submissions").select("id",{count:"exact",head:true}),
      admin.from("submissions").select("id",{count:"exact",head:true}).eq("verdict","Accepted"),
    ]);
    if (problemCount.error || submissionCount.error || acceptedCount.error) throw new Error("Could not read platform statistics.");
    stats = { problems:problemCount.count??0, submissions:submissionCount.count??0, accepted:acceptedCount.count??0 };
  } catch (error) { setupError = error instanceof Error ? error.message : "Add your Supabase credentials and run the SQL migration to enable the live problem bank."; }

  return <>
    <section className="hero"><div className="container hero-grid"><div className="fade-in"><div className="eyebrow">Computer Science Society (American Heritage School Broward)</div><h1 className="hero-title">Practice. Learn.<br /><span>Compete.</span></h1><p className="hero-copy">A home for our school’s programmers to solve thoughtful challenges, learn by doing, and track their progress.</p><div className="hero-buttons"><Link href="/problems"><Button size="lg">Browse problems <ArrowRight size={16} /></Button></Link><Link href="/leaderboard"><Button variant="secondary" size="lg"><Trophy size={16} /> View leaderboard</Button></Link></div></div><div className="hero-identity"><Image className="hero-logo" src="/logo.gif" alt="Computer Science Society at American Heritage School Broward logo" width={220} height={220} unoptimized priority /></div></div></section>
    <section className="container section" style={{ paddingBottom:28 }}><div className="stat-grid">{[{label:"Published problems",value:stats?.problems},{label:"Solutions submitted",value:stats?.submissions},{label:"Accepted submissions",value:stats?.accepted}].map(stat=><div className="card stat-card" key={stat.label}><div className="stat-label">{stat.label}</div><div className="stat-value">{stat.value?.toLocaleString() ?? "—"}</div></div>)}</div></section>
    <section className="container section" style={{ paddingTop:24 }}><div className="section-title-row"><div><div className="eyebrow">Start here</div><h2 className="section-title">Fresh challenges</h2></div><Link href="/problems" className="muted" style={{ fontSize:14,display:"flex",gap:5,alignItems:"center" }}>All problems <ArrowRight size={15} /></Link></div>
      {problems.length ? <div className="card table-wrap"><table className="problems-table"><thead><tr><th>Challenge</th><th>Difficulty</th><th className="optional-mobile">Topics</th><th className="optional-mobile">Added</th></tr></thead><tbody>{problems.map(problem=><tr key={problem.id}><td><Link href={`/problems/${problem.slug}`} style={{ fontWeight:700 }}>{problem.title}</Link></td><td><Badge className={`difficulty-${problem.difficulty.toLowerCase()}`}>{problem.difficulty}</Badge></td><td className="optional-mobile" style={{ display:"flex",gap:6,flexWrap:"wrap" }}>{problem.problem_tags?.slice(0,3).map(tag=><span className="tag" key={tag.tag}>{tag.tag}</span>)}</td><td className="optional-mobile muted">{new Intl.DateTimeFormat("en",{month:"short",day:"numeric"}).format(new Date(problem.created_at))}</td></tr>)}</tbody></table></div> : <div className="empty"><Braces size={25} style={{ marginBottom:8,color:"var(--blue)" }} /><div>{setupError ? "The problem bank is getting ready." : "No challenges are published yet."}</div>{setupError && <p className="hint">Configure Supabase and apply the included migration to make the live platform available.</p>}</div>}
    </section>
  </>;
}
