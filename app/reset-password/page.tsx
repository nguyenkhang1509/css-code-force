"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/browser";

export default function ResetPasswordPage(){
  const [email,setEmail]=useState("");const [password,setPassword]=useState("");const [sent,setSent]=useState(false);const [updating,setUpdating]=useState(false);const [error,setError]=useState("");const [done,setDone]=useState(false);
  async function send(event:React.FormEvent){event.preventDefault();setError("");try{const {error}=await createClient().auth.resetPasswordForEmail(email,{redirectTo:`${window.location.origin}/reset-password`});if(error)throw error;setSent(true)}catch(cause){setError(cause instanceof Error?cause.message:"Could not send a reset email.")}}
  async function update(event:React.FormEvent){event.preventDefault();setUpdating(true);setError("");try{const {error}=await createClient().auth.updateUser({password});if(error)throw error;setDone(true)}catch(cause){setError(cause instanceof Error?cause.message:"The reset link may have expired. Request a new one.")}finally{setUpdating(false)}}
  return <section className="card auth-card"><div className="eyebrow">Account access</div><h1 className="auth-title">Reset password</h1>{done?<p className="success" style={{marginTop:18}}>Password updated. You can now <Link href="/login">sign in</Link>.</p>:<><p className="muted" style={{margin:"6px 0 0",fontSize:14}}>We’ll email you a secure link, or let you choose a new password from one.</p>{!sent?<form className="auth-form" onSubmit={send}><div className="field"><label className="label" htmlFor="email">Account email</label><Input id="email" type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)}/></div>{error&&<p className="alert">{error}</p>}<Button type="submit" style={{width:"100%"}}>Send reset link</Button></form>:<><p className="success" style={{marginTop:17}}>If an account exists for that address, a reset link is on its way.</p><form className="auth-form" onSubmit={update}><div className="field"><label className="label" htmlFor="password">New password</label><Input id="password" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={e=>setPassword(e.target.value)}/></div>{error&&<p className="alert">{error}</p>}<Button type="submit" disabled={updating}>{updating?"Updating…":"Set new password"}</Button></form></>}</>}<p className="muted" style={{marginTop:18,fontSize:13}}><Link href="/login">Back to sign in</Link></p></section>;
}
