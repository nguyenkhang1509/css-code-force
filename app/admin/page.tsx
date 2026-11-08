import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, ShieldCheck } from "lucide-react";
import { getViewer } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { Button } from "@/components/ui/button";
import { AdminListClient } from "@/components/admin-list-client";

export const dynamic="force-dynamic";

export default async function AdminPage(){
  const viewer=await getViewer().catch(()=>null);if(!viewer)redirect("/login?next=/admin");if(viewer.profile.role!=="admin")redirect("/problems");
  const admin=createAdminClient();const [{data:problems},{data:stats}]=await Promise.all([admin.from("problems").select("*,problem_tags(tag)").order("created_at",{ascending:false}),admin.rpc("problem_submission_stats")]);
  const byProblem=new Map((stats??[]).map((row:{problem_id:string;total_submissions:number;accepted_submissions:number})=>[row.problem_id,row]));
  const initialRows=(problems??[]).map(problem=>({...problem,submission_stats:byProblem.get(problem.id)??{total_submissions:0,accepted_submissions:0}}));
  return <section className="container admin-layout"><aside className="card admin-side"><div className="eyebrow"><ShieldCheck size={13} style={{display:"inline",verticalAlign:"-2px",marginRight:5}}/>Admin</div><h2 style={{fontSize:18,margin:"5px 0 14px"}}>Problem bank</h2><Link className="admin-nav-link" href="/admin">All problems</Link><Link className="admin-nav-link" href="/admin/problems/new">Create problem</Link></aside><div className="admin-content"><div><div className="section-title-row"><div><div className="eyebrow">Manage challenges</div><h1 className="page-heading" style={{fontSize:31}}>Problem bank</h1></div><Link href="/admin/problems/new"><Button><Plus size={16}/> New problem</Button></Link></div><AdminListClient initialRows={initialRows}/></div></div></section>;
}
