"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Menu, Moon, Sun, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/browser";

export function NavbarActions({ username }: { username: string | null }) {
  const [open, setOpen] = useState(false);
  const subscribeTheme = useCallback((callback:()=>void) => { const observer=new MutationObserver(callback);observer.observe(document.documentElement,{attributes:true,attributeFilter:["class"]});return()=>observer.disconnect(); },[]);
  const dark = useSyncExternalStore(subscribeTheme,()=>document.documentElement.classList.contains("dark"),()=>false);
  const router = useRouter();
  useEffect(() => { const stored = localStorage.getItem("css-theme"); const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches; document.documentElement.classList.toggle("dark", stored ? stored === "dark" : prefersDark); }, []);
  function toggleTheme() {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("css-theme", next ? "dark" : "light");
  }
  async function signOut() {
    try { await createClient().auth.signOut(); } finally { router.push("/"); router.refresh(); }
  }
  return <div className="nav-actions">
    <Button variant="ghost" size="sm" aria-label="Toggle dark mode" title="Toggle dark mode" onClick={toggleTheme}>{dark ? <Sun size={16} /> : <Moon size={16} />}</Button>
    {username ? <><Link className="desktop-auth muted" href="/profile">@{username}</Link><Button variant="secondary" size="sm" className="desktop-auth" onClick={signOut}>Sign out</Button></> : <><Link className="desktop-auth" href="/login"><Button variant="ghost" size="sm">Sign in</Button></Link><Link className="desktop-auth" href="/signup"><Button size="sm">Join the club</Button></Link></>}
    {username ? <><Link className="mobile-auth" href="/profile">@{username}</Link><Button variant="ghost" size="sm" className="mobile-auth" onClick={signOut}>Sign out</Button></> : <Link className="mobile-auth" href="/login">Sign in</Link>}
    <Button variant="ghost" size="sm" className="mobile-toggle" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} aria-controls="site-navigation" onClick={() => { setOpen(v => !v); document.getElementById("site-navigation")?.classList.toggle("open"); }}>{open ? <X size={18} /> : <Menu size={18} />}</Button>
    <span className={open ? "mobile-menu-anchor" : "sr-only"} />
  </div>;
}
