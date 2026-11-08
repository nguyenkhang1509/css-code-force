import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, CircleUserRound, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function PublicProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  let supabase;
  try {
    supabase = await createClient();
  } catch {
    notFound();
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id,username,full_name,bio,created_at")
    .ilike("username", username)
    .maybeSingle();
  if (!profile) notFound();

  const [{ data: progress }, { data: submissions }, { data: leaderboard }] = await Promise.all([
    supabase.from("user_problem_progress").select("problem_id,solved_at").eq("user_id", profile.id).order("solved_at", { ascending: false }),
    supabase.rpc("profile_activity", { p_username: profile.username }),
    supabase.rpc("leaderboard_rows"),
  ]);
  const activityRows = (submissions ?? []) as Array<{ submission_id: string; problem_title: string | null; problem_slug: string | null; verdict: string; language: string; submitted_at: string }>;
  const leaderboardRows = (leaderboard ?? []) as Array<{ user_id: string; accepted_count: number }>;
  const solvedIds = progress?.map((row) => row.problem_id) ?? [];
  const { data: solvedProblems } = solvedIds.length
    ? await supabase.from("problems").select("id,difficulty").in("id", solvedIds)
    : { data: [] };
  const byDifficulty = { Easy: 0, Medium: 0, Hard: 0 };
  for (const problem of solvedProblems ?? []) byDifficulty[problem.difficulty as keyof typeof byDifficulty]++;
  const accepted = leaderboardRows.find((row) => row.user_id === profile.id)?.accepted_count ?? 0;

  return (
    <section className="container section">
      <div className="card profile-hero">
        <div className="avatar">{profile.username.slice(0, 1).toUpperCase()}</div>
        <div style={{ flex: 1 }}>
          <div className="eyebrow"><CircleUserRound size={13} style={{ display: "inline", verticalAlign: "-2px", marginRight: 5 }} />Public profile</div>
          <h1 className="page-heading" style={{ fontSize: 30, marginTop: 3 }}>{profile.full_name || profile.username}</h1>
          <div className="muted">@{profile.username} - joined {formatDate(profile.created_at)}</div>
          {profile.bio && <p className="muted" style={{ margin: "9px 0 0" }}>{profile.bio}</p>}
        </div>
      </div>

      <div className="profile-stats" style={{ marginTop: 15 }}>
        {[
          { icon: CheckCircle2, value: solvedIds.length, label: "Unique problems solved" },
          { icon: Send, value: accepted, label: "Accepted submissions" },
          { icon: CheckCircle2, value: byDifficulty.Easy, label: "Easy solved" },
          { icon: CheckCircle2, value: `${byDifficulty.Medium} / ${byDifficulty.Hard}`, label: "Medium / Hard solved" },
        ].map((stat) => <div className="card profile-stat" key={stat.label}><stat.icon size={16} color="var(--blue)" /><strong>{stat.value}</strong><span>{stat.label}</span></div>)}
      </div>

      <div style={{ marginTop: 32 }}>
        <div className="section-title-row"><h2 className="section-title">Recent submissions</h2><Badge>{progress?.length ?? 0} solved</Badge></div>
        {activityRows.length ? <div className="card table-wrap">
          <table className="problems-table">
            <thead><tr><th>Problem</th><th>Result</th><th className="optional-mobile">Language</th><th className="optional-mobile">Date</th></tr></thead>
            <tbody>{activityRows.map((row) => <tr key={row.submission_id}>
              <td>{row.problem_slug ? <Link href={`/problems/${row.problem_slug}`} style={{ fontWeight: 650 }}>{row.problem_title}</Link> : "Removed problem"}</td>
              <td className={`verdict ${row.verdict === "Accepted" ? "verdict-accepted" : "verdict-rejected"}`}>{row.verdict}</td>
              <td className="optional-mobile">{row.language === "python" ? "Python 3" : "C++17"}</td>
              <td className="optional-mobile muted">{formatDate(row.submitted_at)}</td>
            </tr>)}</tbody>
          </table>
        </div> : <div className="empty">No submissions yet.</div>}
      </div>
    </section>
  );
}
