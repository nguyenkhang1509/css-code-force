import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, CircleUserRound, Clock3, Percent, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProfileEditor } from "@/components/profile-editor";
import { getViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";

export const dynamic="force-dynamic";

export default async function MyProfilePage(){
  const viewer=await getViewer().catch(()=>null);if(!viewer)redirect("/login?next=/profile");
  const supabase=await createClient();
  const [{data:submissions},{data:progress},{data:recent}] = await Promise.all([
    supabase.from("submissions").select("verdict,problem_id").eq("user_id",viewer.user.id),
    supabase.from("user_problem_progress").select("problem_id,solved_at").eq("user_id",viewer.user.id),
    supabase.from("submissions").select("id,verdict,language,execution_time_ms,created_at,problems(title,slug)").eq("user_id",viewer.user.id).order("created_at",{ascending:false}).limit(8),
  ]);
  const total=submissions?.length??0;const accepted=submissions?.filter(s=>s.verdict==="Accepted").length??0;const solvedIds=progress?.map(p=>p.problem_id)??[];
  const {data:solvedProblems}=solvedIds.length?await supabase.from("problems").select("id,difficulty").in("id",solvedIds):{data:[]};
  const byDifficulty={Easy:0,Medium:0,Hard:0};for(const problem of solvedProblems??[])byDifficulty[problem.difficulty as keyof typeof byDifficulty]++;
  return <section className="container section"><div className="section-title-row"><div><div className="eyebrow">Your space</div><h1 className="page-heading">Profile</h1></div><Link href={`/u/${viewer.profile.username}`}><Button variant="secondary"><CircleUserRound size={15}/> View public profile</Button></Link></div><div className="card profile-hero"><div className="avatar">{viewer.profile.username.slice(0,1).toUpperCase()}</div><div style={{flex:1}}><div style={{fontSize:23,fontWeight:780,letterSpacing:"-.04em"}}>{viewer.profile.full_name||viewer.profile.username}</div><div className="muted">@{viewer.profile.username} · joined {formatDate(viewer.profile.created_at)}</div>{viewer.profile.bio&&<p className="muted" style={{margin:"8px 0 0"}}>{viewer.profile.bio}</p>}</div></div>
    <div className="profile-stats" style={{marginTop:15}}>{[{icon:CheckCircle2,value:solvedIds.length,label:"Problems solved"},{icon:Send,value:total,label:"Submissions"},{icon:Percent,value:total?`${Math.round(accepted/total*100)}%`:"0%",label:"Acceptance rate"},{icon:Clock3,value:`${byDifficulty.Easy}/${byDifficulty.Medium}/${byDifficulty.Hard}`,label:"Easy / Medium / Hard"}].map(stat=><div className="card profile-stat" key={stat.label}><stat.icon size={16} color="var(--blue)"/><strong>{stat.value}</strong><span>{stat.label}</span></div>)}</div>
    <ProfileEditor profile={{username:viewer.profile.username,full_name:viewer.profile.full_name,bio:viewer.profile.bio}} />
    <div style={{marginTop:32}}><div className="section-title-row"><h2 className="section-title">Recent activity</h2><Link href="/submissions" className="muted" style={{fontSize:13}}>All submissions</Link></div>{recent?.length?<div className="card table-wrap"><table className="problems-table"><thead><tr><th>Problem</th><th>Verdict</th><th>Language</th><th>Date</th></tr></thead><tbody>{recent.map(row=>{const p=row.problems as unknown as {title:string;slug:string}|null;return <tr key={row.id}><td>{p?<Link href={`/problems/${p.slug}`} style={{fontWeight:650}}>{p.title}</Link>:"Removed problem"}</td><td><Link className={`verdict ${row.verdict==="Accepted"?"verdict-accepted":"verdict-rejected"}`} href={`/submissions/${row.id}`}>{row.verdict}</Link></td><td>{row.language==="python"?"Python 3":"C++17"}</td><td className="muted">{formatDate(row.created_at)}</td></tr>})}</tbody></table></div>:<div className="empty">Your recent submissions will appear here. <Link href="/problems" style={{color:"var(--blue)"}}>Find a problem to start.</Link></div>}</div>
  </section>;
}
