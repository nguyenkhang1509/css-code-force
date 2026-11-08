import Link from "next/link";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";

export const dynamic="force-dynamic";

export default async function SubmissionsPage(){
  const viewer=await getViewer().catch(()=>null);if(!viewer)redirect("/login?next=/submissions");
  const supabase=await createClient();const {data,error}=await supabase.from("submissions").select("id,verdict,language,execution_time_ms,passed_test_cases,total_test_cases,created_at,problems(title,slug)").eq("user_id",viewer.user.id).order("created_at",{ascending:false}).limit(100);
  return <section className="container section"><div style={{marginBottom:22}}><div className="eyebrow">Your work</div><h1 className="page-heading">Submissions</h1><p className="page-subtitle">Your latest solutions and judging results.</p></div>{error&&<div className="alert">Could not load submissions. Refresh to try again.</div>}{data?.length?<div className="card table-wrap"><table className="problems-table"><thead><tr><th>Problem</th><th>Verdict</th><th>Language</th><th className="optional-mobile">Passed</th><th>Time</th><th className="optional-mobile">Submitted</th></tr></thead><tbody>{data.map(row=>{const problem=row.problems as unknown as {title:string;slug:string}|null;return <tr key={row.id}><td>{problem?<Link href={`/problems/${problem.slug}`} style={{fontWeight:650}}>{problem.title}</Link>:"Removed problem"}</td><td><Link href={`/submissions/${row.id}`} className={`verdict ${row.verdict==="Accepted"?"verdict-accepted":row.verdict==="Pending"?"verdict-pending":"verdict-rejected"}`}>{row.verdict}</Link></td><td>{row.language==="python"?"Python 3":"C++17"}</td><td className="optional-mobile">{row.total_test_cases?`${row.passed_test_cases}/${row.total_test_cases}`:"—"}</td><td>{row.execution_time_ms==null?"—":`${row.execution_time_ms} ms`}</td><td className="optional-mobile muted">{formatDate(row.created_at)}</td></tr>})}</tbody></table></div>:<div className="empty">Your submission history is empty. <Link href="/problems" style={{color:"var(--blue)"}}>Browse problems</Link> to get started.</div>}</section>;
}
