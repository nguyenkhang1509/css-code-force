"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { UserRoundPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/browser";

export default function SignupPage(){
  const [username,setUsername]=useState("");const [email,setEmail]=useState("");const [password,setPassword]=useState("");const [error,setError]=useState("");const [message,setMessage]=useState("");const [busy,setBusy]=useState(false);const router=useRouter();
  async function submit(event:React.FormEvent){event.preventDefault();setBusy(true);setError("");setMessage("");if(!/^[a-zA-Z0-9_]{3,24}$/.test(username)){setError("Choose a username with 3–24 letters, numbers, or underscores.");setBusy(false);return}try{const client=createClient();const {data,error}=await client.auth.signUp({email,password,options:{data:{username:username.toLowerCase()},emailRedirectTo:`${window.location.origin}/login`}});if(error){setError(error.message);return}if(data.session){router.push("/problems");router.refresh()}else{setMessage("Account created. Check your email to confirm your address, then sign in.")}}catch(cause){setError(cause instanceof Error?cause.message:"Could not create your account.")}finally{setBusy(false)}}
  return <section className="card auth-card"><div className="eyebrow"><UserRoundPlus size={14} style={{display:"inline",verticalAlign:"-2px",marginRight:5}}/>Join the club</div><h1 className="auth-title">Make your account</h1><p className="muted" style={{margin:"6px 0 0",fontSize:14}}>One account for every problem, submission, and new personal best.</p><form className="auth-form" onSubmit={submit}><div className="field"><label className="label" htmlFor="username">Username</label><Input id="username" autoComplete="username" minLength={3} maxLength={24} pattern="[A-Za-z0-9_]+" required value={username} onChange={e=>setUsername(e.target.value)}/><p className="hint">Your public handle. Letters, numbers, and underscores.</p></div><div className="field"><label className="label" htmlFor="email">Email</label><Input id="email" type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)}/></div><div className="field"><label className="label" htmlFor="password">Password</label><Input id="password" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={e=>setPassword(e.target.value)}/><p className="hint">At least 8 characters.</p></div>{error&&<p className="alert" role="alert">{error}</p>}{message&&<p className="success" role="status">{message}</p>}<Button type="submit" size="lg" style={{width:"100%"}} disabled={busy}>{busy?"Creating account…":"Create account"}</Button></form><p className="muted" style={{fontSize:13,marginTop:17}}>Already have an account? <Link href="/login" style={{color:"var(--blue)"}}>Sign in</Link></p></section>;
}
