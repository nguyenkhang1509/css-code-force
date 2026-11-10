"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type ProblemRow={id:string;title:string;slug:string;difficulty:string;published:boolean;created_at:string;submission_stats:{total_submissions:number;accepted_submissions:number}};
export function AdminListClient({initialRows}:{initialRows:ProblemRow[]}){const [rows,setRows]=useState(initialRows);const [error,setError]=useState("");const router=useRouter();
  async function remove(problem:ProblemRow){if(!window.confirm(`Delete “${problem.title}” and its submissions? This cannot be undone.`))return;setError("");try{const response=await fetch(`/api/admin/problems/${problem.id}`,{method:"DELETE"});const data=await response.json();if(!response.ok)throw new Error(data.error||"Could not delete the problem.");setRows(current=>current.filter(row=>row.id!==problem.id));router.refresh()}catch(cause){setError(cause instanceof Error?cause.message:"Could not delete the problem.")}}
  return <div>{error&&<div className="alert" style={{marginBottom:14}}>{error}</div>}{rows.length?<div className="card table-wrap"><table className="problems-table"><thead><tr><th>Problem</th><th>Difficulty</th><th>Status</th><th className="optional-mobile">Submissions</th><th>Actions</th></tr></thead><tbody>{rows.map(row=><tr key={row.id}><td><strong>{row.title}</strong><div className="muted" style={{fontSize:12}}>/{row.slug}</div></td><td>{row.difficulty}</td><td><Badge>{row.published?"Published":"Draft"}</Badge></td><td className="optional-mobile">{row.submission_stats.total_submissions} attempts · {row.submission_stats.accepted_submissions} unique accepted</td><td><div style={{display:"flex",gap:6}}><Link href={`/admin/problems/${row.id}`} aria-label={`Edit ${row.title}`}><Button variant="secondary" size="sm"><Pencil size={14}/></Button></Link><Button variant="ghost" size="sm" aria-label={`Delete ${row.title}`} onClick={()=>remove(row)}><Trash2 size={14}/></Button></div></td></tr>)}</tbody></table></div>:<div className="empty">No problems yet.<div style={{marginTop:12}}><Link href="/admin/problems/new"><Button><Plus size={15}/> Create your first problem</Button></Link></div>}</div>;
}
