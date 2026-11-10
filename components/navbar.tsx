import Link from "next/link";
import Image from "next/image";
import { getViewer } from "@/lib/auth";
import { NavbarActions } from "@/components/navbar-actions";

const links = [
  { href: "/problems", label: "Problems" },
  { href: "/code-quest-tryout", label: "Code Quest Tryout" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/submissions", label: "Submissions" },
];

export async function Navbar() {
  let viewer = null;
  try { viewer = await getViewer(); } catch { /* Setup instructions are shown on the auth pages. */ }
  return <header className="nav-wrap"><div className="container nav">
    <Link href="/" className="brand" aria-label="Computer Science Society (American Heritage School Broward) home">
      <Image className="brand-logo" src="/logo.gif" alt="" width={44} height={44} unoptimized priority />
      <span className="brand-copy"><span className="brand-name">Computer Science Society</span><span className="brand-school">(American Heritage School Broward)</span></span>
    </Link>
    <nav className="nav-links" id="site-navigation">{links.map(link => <Link key={link.href} href={link.href}>{link.label}</Link>)}{viewer?.profile.role === "admin" && <Link href="/admin">Admin</Link>}</nav>
    <NavbarActions username={viewer?.profile.username ?? null} />
  </div></header>;
}
