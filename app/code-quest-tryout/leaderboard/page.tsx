import Link from "next/link";
import { Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type CodeQuestLeaderboardRow = {
  user_id: string;
  username: string;
  full_name: string | null;
  solved_count: number;
  attempted_count: number;
};

export default async function CodeQuestLeaderboardPage() {
  let rows: CodeQuestLeaderboardRow[] = [];
  let problemCount = 0;
  let error = "";

  try {
    const supabase = await createClient();
    const [leaderboard, problems] = await Promise.all([
      supabase.rpc("code_quest_leaderboard_rows"),
      supabase
        .from("problems")
        .select("id", { count: "exact", head: true })
        .eq("published", true)
        .eq("section", "Code Quest Tryout"),
    ]);
    if (leaderboard.error) throw leaderboard.error;
    rows = leaderboard.data ?? [];
    problemCount = problems.count ?? 0;
  } catch (cause) {
    error = cause instanceof Error ? cause.message : "Could not load the Code Quest leaderboard.";
  }

  return (
    <section className="container section">
      <div className="section-title-row">
        <div>
          <div className="eyebrow"><Trophy size={13} style={{ display: "inline", verticalAlign: "-2px", marginRight: 5 }} />Tryout standings</div>
          <h1 className="page-heading">Code Quest Tryout Leaderboard</h1>
          <p className="page-subtitle">Ranked by Code Quest problems solved. Only students with an accepted tryout solution appear here.</p>
        </div>
        <Link href="/code-quest-tryout"><Button variant="secondary">View tryout problems</Button></Link>
      </div>

      {error && <div className="alert" role="alert" style={{ marginBottom: 15 }}>Could not load the Code Quest leaderboard. Apply the Code Quest leaderboard migration and refresh.</div>}

      {rows.length ? (
        <div className="card table-wrap">
          <table className="problems-table">
            <thead><tr>
              <th style={{ width: 80 }}>Rank</th>
              <th>Programmer</th>
              <th>Problems solved</th>
              <th className="optional-mobile">Problems attempted</th>
              <th className="optional-mobile">Progress</th>
            </tr></thead>
            <tbody>{rows.map((row, index) => (
              <tr key={row.user_id}>
                <td><span className={`leaderboard-rank ${index < 3 ? "top" : ""}`}>{String(index + 1).padStart(2, "0")}</span></td>
                <td>
                  <Link href={`/u/${row.username}`} style={{ fontWeight: 750 }}>{row.full_name || row.username}</Link>
                  <div className="muted" style={{ fontSize: 12 }}>@{row.username}</div>
                </td>
                <td style={{ fontWeight: 700 }}>{row.solved_count}</td>
                <td className="optional-mobile">{row.attempted_count}</td>
                <td className="optional-mobile" style={{ minWidth: 140 }}>
                  <div className="progress-track">
                    <div className="progress-fill" style={{ width: `${Math.min(100, problemCount ? row.solved_count / problemCount * 100 : 0)}%` }} />
                  </div>
                </td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      ) : (
        <div className="empty">{error ? "The tryout leaderboard will appear once the database is connected." : "No students have solved a Code Quest tryout problem yet."}</div>
      )}
    </section>
  );
}
