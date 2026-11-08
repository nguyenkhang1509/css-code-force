"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/browser";

function LoginForm(){
  const params=useSearchParams();const [email,setEmail]=useState("");const [password,setPassword]=useState("");const [error,setError]=useState("");const [busy,setBusy]=useState(false);const next=params.get("next")||"/problems";
  async function submit(event:React.FormEvent){event.preventDefault();setBusy(true);setError("");try{const client=createClient();const {error}=await client.auth.signInWithPassword({email,password});if(error){setError(error.message);return}window.location.assign(next.startsWith("/")?next:"/problems")}catch(cause){setError(cause instanceof Error?cause.message:"Could not sign in.")}finally{setBusy(false)}}
  return <section className="card auth-card"><div className="eyebrow"><LockKeyhole size={13} style={{display:"inline",verticalAlign:"-2px",marginRight:5}}/>Welcome back</div><h1 className="auth-title">Sign in to CSS</h1><p className="muted" style={{margin:"6px 0 0",fontSize:14}}>Pick up where your last solution left off.</p><form className="auth-form" onSubmit={submit}><div className="field"><label className="label" htmlFor="email">Email</label><Input id="email" type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)}/></div><div className="field"><label className="label" htmlFor="password">Password</label><Input id="password" type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)}/></div>{error&&<p className="alert" role="alert">{error}</p>}<Button type="submit" size="lg" style={{width:"100%"}} disabled={busy}>{busy?"Signing in…":"Sign in"}</Button></form><div className="inline-links" style={{marginTop:17}}><span>New here? <Link href="/signup">Create an account</Link></span><Link href="/reset-password">Forgot password?</Link></div></section>;
}
export default function LoginPage(){return <Suspense fallback={<div className="empty">Loading sign-in…</div>}><LoginForm/></Suspense>}
