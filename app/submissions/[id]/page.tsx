import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Clock3, Code2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";

export const dynamic="force-dynamic";

export default async function SubmissionDetailPage({params}:{params:Promise<{id:string}>}){
  const viewer=await getViewer().catch(()=>null);if(!viewer)redirect("/login?next=/submissions");const {id}=await params;const supabase=await createClient();
  const {data:submission}=await supabase.from("submissions").select("*,problems(title,slug)").eq("id",id).eq("user_id",viewer.user.id).maybeSingle();if(!submission)notFound();const problem=submission.problems as unknown as {title:string;slug:string}|null;
  return <section className="container section"><div style={{marginBottom:17}}><Link href="/submissions" className="muted" style={{display:"inline-flex",gap:6,alignItems:"center",fontSize:13}}><ArrowLeft size={14}/> Submissions</Link></div><div className="section-title-row"><div><div className="eyebrow">Submission details</div><h1 className="page-heading" style={{fontSize:31}}>{problem?<Link href={`/problems/${problem.slug}`}>{problem.title}</Link>:"Removed problem"}</h1></div><span className={`verdict ${submission.verdict==="Accepted"?"verdict-accepted":"verdict-rejected"}`} style={{fontSize:18}}>{submission.verdict}</span></div><div style={{display:"flex",gap:16,flexWrap:"wrap",color:"var(--muted)",fontSize:13,marginBottom:17}}><span><Code2 size={14} style={{display:"inline",verticalAlign:"-3px",marginRight:5}}/>{submission.language==="python"?"Python 3":"C++17"}</span><span><Clock3 size={14} style={{display:"inline",verticalAlign:"-3px",marginRight:5}}/>{submission.execution_time_ms==null?"Execution time unavailable":`${submission.execution_time_ms} ms`}</span><span>{formatDate(submission.created_at)}</span><Badge>{submission.total_test_cases?`${submission.passed_test_cases} / ${submission.total_test_cases} tests passed`:"No test totals available"}</Badge></div>{submission.error_message&&<div className="alert" style={{marginBottom:16}}>{submission.error_message}</div>}<div className="card" style={{overflow:"hidden"}}><div className="editor-toolbar"><strong style={{fontSize:13}}>Submitted source</strong><Badge>{submission.language==="python"?"Python 3":"C++17"}</Badge></div><pre style={{margin:0,padding:20,overflow:"auto",font:"13px/1.65 ui-monospace,SFMono-Regular,Consolas,monospace",whiteSpace:"pre",background:"var(--surface)"}}>{submission.source_code}</pre></div></section>;
}
