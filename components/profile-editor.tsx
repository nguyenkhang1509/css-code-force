"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ProfileEditor({ profile }: { profile:{username:string;full_name:string|null;bio:string} }) {
  const [username,setUsername]=useState(profile.username); const [name,setName]=useState(profile.full_name??""); const [bio,setBio]=useState(profile.bio); const [error,setError]=useState(""); const [saved,setSaved]=useState(false); const [busy,setBusy]=useState(false); const router=useRouter();
  async function save(event:React.FormEvent) { event.preventDefault(); setBusy(true);setError("");setSaved(false);try{const response=await fetch("/api/profile",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({username,full_name:name||null,bio})});const data=await response.json();if(!response.ok){setError(data.error||"Could not save profile.");return}setSaved(true);router.refresh()}catch{setError("Could not connect to the server.")}finally{setBusy(false)} }
  return <form onSubmit={save} className="card-plain" style={{ padding:20, marginTop:18 }}><div className="field"><label className="label" htmlFor="username">Username</label><Input id="username" required minLength={3} maxLength={24} pattern="[A-Za-z0-9_]+" value={username} onChange={event=>setUsername(event.target.value)} /><p className="hint">3–24 letters, numbers, or underscores. This is your public profile URL.</p></div><div className="field"><label className="label" htmlFor="full-name">Display name</label><Input id="full-name" maxLength={80} value={name} onChange={event=>setName(event.target.value)} /></div><div className="field"><label className="label" htmlFor="bio">Bio</label><textarea id="bio" className="textarea" maxLength={280} value={bio} onChange={event=>setBio(event.target.value)} /><p className="hint">{bio.length}/280 characters</p></div>{error&&<p className="alert">{error}</p>}{saved&&<p className="success">Profile saved.</p>}<Button type="submit" disabled={busy}>{busy?"Saving…":"Save changes"}</Button></form>;
}
