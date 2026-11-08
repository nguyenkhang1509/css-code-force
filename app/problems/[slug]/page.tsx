import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock3, MemoryStick, Tag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Markdown } from "@/components/markdown";
import { ProblemWorkspace } from "@/components/problem-workspace";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/auth";

export const dynamic = "force-dynamic";
type Props = { params:Promise<{slug:string}> };

export async function generateMetadata({ params }:Props):Promise<Metadata> {
  const {slug}=await params;
  try { const supabase=await createClient();const {data}=await supabase.from("problems").select("title").eq("slug",slug).eq("published",true).maybeSingle();return {title:data?.title??"Problem"}; } catch { return {title:"Problem"}; }
}

export default async function ProblemPage({ params }:Props) {
  const {slug}=await params;
  let supabase;
  try { supabase=await createClient(); } catch { notFound(); }
  const {data:problem}=await supabase.from("problems").select("*,problem_tags(tag),test_cases(id,input,expected_output,is_sample,explanation,case_index),reference_solutions(python,cpp,published)").eq("slug",slug).eq("published",true).maybeSingle();
  if (!problem) notFound();
  const samples=(problem.test_cases??[]).filter((test:{is_sample:boolean})=>test.is_sample).sort((a:{case_index:number},b:{case_index:number})=>a.case_index-b.case_index);
  let recent: {id:string;verdict:string;language:string;execution_time_ms:number|null;created_at:string}[]=[];
  try { const viewer=await getViewer();if(viewer){const {data}=await supabase.from("submissions").select("id,verdict,language,execution_time_ms,created_at").eq("problem_id",problem.id).eq("user_id",viewer.user.id).order("created_at",{ascending:false}).limit(12);recent=data??[];} } catch { /* Guests can still read the statement and samples. */ }
  return <div className="container section" style={{ paddingTop:30 }}><div style={{ marginBottom:17 }}><Link href="/problems" className="muted" style={{ display:"inline-flex",alignItems:"center",gap:6,fontSize:13 }}><ArrowLeft size={14} /> All problems</Link></div><div className="problem-layout">
    <article className="card problem-panel"><div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,flexWrap:"wrap" }}><div><div className="eyebrow">Problem</div><h1 className="page-heading" style={{ fontSize:31,marginTop:4 }}>{problem.title}</h1></div><Badge className={`difficulty-${problem.difficulty.toLowerCase()}`}>{problem.difficulty}</Badge></div>
      <div style={{ display:"flex",gap:14,alignItems:"center",flexWrap:"wrap",marginTop:14,color:"var(--muted)",fontSize:12 }}><span><Clock3 size={14} style={{ display:"inline",verticalAlign:"-3px",marginRight:4 }} />{problem.time_limit_ms} ms</span><span><MemoryStick size={14} style={{ display:"inline",verticalAlign:"-3px",marginRight:4 }} />{problem.memory_limit_mb} MB</span><span><Tag size={14} style={{ display:"inline",verticalAlign:"-3px",marginRight:4 }} />Python 3 · C++17</span></div>
      <div style={{ display:"flex",gap:6,flexWrap:"wrap",marginTop:12 }}>{problem.problem_tags?.map((item:{tag:string})=><span className="tag" key={item.tag}>{item.tag}</span>)}</div>
      <hr className="divider" /><Markdown content={problem.statement} />
      <div className="format-block"><h3>Input format</h3><Markdown content={problem.input_format} /></div><div className="format-block"><h3>Output format</h3><Markdown content={problem.output_format} /></div><div className="format-block"><h3>Constraints</h3><Markdown content={problem.constraints} /></div>
      <div className="format-block"><h3>Examples</h3>{samples.map((sample:{id:string;input:string;expected_output:string;explanation:string|null},i:number)=><div className="sample-box" key={sample.id}><strong style={{ fontSize:12 }}>Example {i+1}</strong><div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginTop:8 }}><div><span className="muted" style={{ fontSize:11 }}>Input</span><pre>{sample.input}</pre></div><div><span className="muted" style={{ fontSize:11 }}>Output</span><pre>{sample.expected_output}</pre></div></div>{sample.explanation&&<p className="muted" style={{ margin:"10px 0 0",fontSize:12 }}>{sample.explanation}</p>}</div>)}</div>
      {problem.reference_solutions?.some((solution:{published:boolean})=>solution.published)&&<details className="format-block"><summary style={{cursor:"pointer",fontWeight:700,color:"var(--blue)"}}>Published reference solutions</summary>{problem.reference_solutions.filter((solution:{published:boolean})=>solution.published).map((solution:{python:string|null;cpp:string|null},i:number)=><div className="sample-box" key={i}>{solution.python&&<><strong>Python 3</strong><pre style={{marginTop:8,whiteSpace:"pre-wrap"}}>{solution.python}</pre></>}{solution.cpp&&<><strong>C++17</strong><pre style={{marginTop:8,whiteSpace:"pre-wrap"}}>{solution.cpp}</pre></>}</div>)}</details>}
    </article><ProblemWorkspace problemId={problem.id} recent={recent} />
  </div></div>;
}
