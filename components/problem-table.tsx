"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Check, Search, SlidersHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { Problem } from "@/lib/types";

type ListedProblem = Problem & { solved?: boolean };
const difficultyRank = { Easy: 1, Medium: 2, Hard: 3 };

export function ProblemTable({ problems }: { problems: ListedProblem[] }) {
  const [search, setSearch] = useState("");
  const [difficulty, setDifficulty] = useState("All difficulties");
  const [tag, setTag] = useState("All topics");
  const [solved, setSolved] = useState("All problems");
  const [sort, setSort] = useState("newest");
  const topics = useMemo(() => [...new Set(problems.flatMap(problem => problem.tags))].sort(), [problems]);
  const filtered = useMemo(() => problems.filter(problem => {
    if (search && !problem.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (difficulty !== "All difficulties" && problem.difficulty !== difficulty) return false;
    if (tag !== "All topics" && !problem.tags.includes(tag)) return false;
    if (solved === "Solved" && !problem.solved) return false;
    if (solved === "Unsolved" && problem.solved) return false;
    return true;
  }).sort((a,b) => sort === "difficulty" ? difficultyRank[a.difficulty] - difficultyRank[b.difficulty] || a.title.localeCompare(b.title) : new Date(b.created_at).getTime() - new Date(a.created_at).getTime()), [problems, search, difficulty, tag, solved, sort]);

  return <>
    <div className="card-plain" style={{ padding:14, marginBottom:14 }}>
      <div style={{ display:"grid", gridTemplateColumns:"minmax(180px,1.5fr) repeat(4,minmax(130px,1fr))", gap:9 }} className="problem-filters">
        <div style={{ position:"relative" }}><Search size={16} style={{ position:"absolute", left:11, top:12, color:"var(--muted)" }} /><Input aria-label="Search problems" placeholder="Search problems…" value={search} onChange={event => setSearch(event.target.value)} style={{ paddingLeft:34 }} /></div>
        <select className="select" aria-label="Filter difficulty" value={difficulty} onChange={event => setDifficulty(event.target.value)}>{["All difficulties","Easy","Medium","Hard"].map(value => <option key={value}>{value}</option>)}</select>
        <select className="select" aria-label="Filter topic" value={tag} onChange={event => setTag(event.target.value)}><option>All topics</option>{topics.map(value => <option key={value}>{value}</option>)}</select>
        <select className="select" aria-label="Filter solved status" value={solved} onChange={event => setSolved(event.target.value)}>{["All problems","Solved","Unsolved"].map(value => <option key={value}>{value}</option>)}</select>
        <select className="select" aria-label="Sort problems" value={sort} onChange={event => setSort(event.target.value)}><option value="newest">Newest first</option><option value="difficulty">Difficulty</option></select>
      </div>
    </div>
    <div className="card table-wrap">
      {filtered.length ? <table className="problems-table"><thead><tr><th style={{ width:75 }}>Status</th><th>Problem</th><th>Difficulty</th><th className="optional-mobile">Topics</th></tr></thead><tbody>{filtered.map((problem,index) => <tr key={problem.id}>
        <td>{problem.solved ? <Check size={17} color="var(--green)" aria-label="Solved" /> : <span className="problem-number">{String(index+1).padStart(2,"0")}</span>}</td>
        <td><Link href={`/problems/${problem.slug}`} style={{ fontWeight:700 }}>{problem.title}</Link></td>
        <td><Badge className={`difficulty-${problem.difficulty.toLowerCase()}`}>{problem.difficulty}</Badge></td>
        <td className="optional-mobile" style={{ display:"flex", gap:6, flexWrap:"wrap" }}>{problem.tags.map(item => <span key={item} className="tag">{item}</span>)}</td>
      </tr>)}</tbody></table> : <div className="empty"><SlidersHorizontal size={22} style={{ marginBottom:8 }} /><div>No problems match these filters.</div></div>}
    </div>
    <style jsx>{`@media(max-width:850px){.problem-filters{grid-template-columns:repeat(2,minmax(0,1fr))!important}.problem-filters>div:first-child{grid-column:1/-1}}@media(max-width:520px){.problem-filters{grid-template-columns:1fr!important}}`}</style>
  </>;
}
