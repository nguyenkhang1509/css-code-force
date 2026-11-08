"use client";

import dynamic from "next/dynamic";
import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { Check, Clock3, Code2, LoaderCircle, Play, Send, Terminal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { STARTER_CODE, type JudgeResult, type Language } from "@/lib/types";
import { formatDate, verdictLabel } from "@/lib/utils";

const Editor = dynamic(() => import("@monaco-editor/react"), { ssr: false, loading: () => <div style={{ height:460, display:"grid", placeItems:"center", color:"var(--muted)" }}><LoaderCircle className="spinner" /> Loading editor…</div> });
type Recent = { id:string; verdict:string; language:string; execution_time_ms:number|null; created_at:string };

export function ProblemWorkspace({ problemId, recent }: { problemId:string; recent:Recent[] }) {
  const [language, setLanguage] = useState<Language>("python");
  const [code, setCode] = useState(STARTER_CODE.python);
  const [busy, setBusy] = useState<"run"|"submit"|null>(null);
  const [result, setResult] = useState<JudgeResult|null>(null);
  const [tab, setTab] = useState<"editor"|"submissions">("editor");
  const subscribeTheme = useCallback((callback:()=>void) => { const observer=new MutationObserver(callback);observer.observe(document.documentElement,{attributes:true,attributeFilter:["class"]});return()=>observer.disconnect(); },[]);
  const theme = useSyncExternalStore(subscribeTheme,()=>document.documentElement.classList.contains("dark")?"vs-dark":"vs",()=>"vs");
  const [error, setError] = useState("");
  const storageKey = `css-code-${problemId}-${language}`;

  function saveCode(value:string) { setCode(value);try { localStorage.setItem(storageKey,value); } catch { /* local storage can be disabled */ } }

  const verdictClass = useMemo(() => result?.verdict === "Accepted" ? "verdict-accepted" : result?.verdict === "Pending" ? "verdict-pending" : "verdict-rejected", [result]);
  async function execute(action: "run"|"submit") {
    setBusy(action); setError(""); setResult(null);
    try {
      const response = await fetch(action === "run" ? "/api/run" : "/api/submit", { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({problemId,language,source:code}) });
      const data = await response.json();
      if (!response.ok) { setError(data.error || "The request could not be completed."); return; }
      setResult(data as JudgeResult);
      if (action === "submit") window.dispatchEvent(new Event("css-submission-saved"));
    } catch {
      setError("Connection lost while judging. Check your submission history before sending it again.");
    } finally { setBusy(null); }
  }
  function changeLanguage(next: Language) {
    if (next === language) return;
    setLanguage(next);
    let saved=STARTER_CODE[next];try{saved=localStorage.getItem(`css-code-${problemId}-${next}`)||saved}catch{/* local storage can be disabled */}setCode(saved);
    setResult(null);
  }

  return <section className="card editor-panel" aria-label="Code editor">
    <div className="tabs"><button className={`tab ${tab === "editor" ? "active" : ""}`} onClick={() => setTab("editor")}>Code editor</button><button className={`tab ${tab === "submissions" ? "active" : ""}`} onClick={() => setTab("submissions")}>My submissions</button></div>
    {tab === "editor" ? <>
      <div className="editor-toolbar"><label style={{ display:"flex", alignItems:"center", gap:8 }}><Code2 size={16} color="var(--blue)" /><span className="sr-only">Programming language</span><select className="select" style={{ width:145, padding:"6px 10px" }} value={language} onChange={event => changeLanguage(event.target.value as Language)}><option value="python">Python 3</option><option value="cpp">C++17</option></select></label><div className="editor-actions"><Button variant="secondary" size="sm" disabled={!!busy} onClick={() => execute("run")}><Play size={14} /> Run code</Button><Button size="sm" disabled={!!busy} onClick={() => execute("submit")}><Send size={14} /> Submit</Button></div></div>
      <Editor height="min(62vh, 540px)" language={language === "python" ? "python" : "cpp"} theme={theme} value={code} onMount={editor=>{try{const saved=localStorage.getItem(storageKey);if(saved){editor.setValue(saved);setCode(saved)}}catch{/* local storage can be disabled */}}} onChange={value => saveCode(value ?? "")} options={{ minimap:{enabled:false}, fontSize:14, tabSize:4, automaticLayout:true, scrollBeyondLastLine:false, wordWrap:"on", lineNumbers:"on", padding:{top:14}, suggestOnTriggerCharacters:true, quickSuggestions:true, ariaLabel:"Solution code editor" }} />
      <div className="editor-footer"><span><Terminal size={13} style={{ display:"inline", verticalAlign:"-2px", marginRight:5 }} />Standard input / output</span><span><Clock3 size={13} style={{ display:"inline", verticalAlign:"-2px", marginRight:5 }} />Code saves in this browser</span></div>
      {error && <div className="result-panel"><div className="alert">{error}</div></div>}
      {busy && <div className="result-panel" role="status"><span className="spinner" style={{ marginRight:9, verticalAlign:"-3px" }} />{busy === "run" ? "Running public samples…" : "Judging your submission…"}</div>}
      {result && <div className="result-panel" aria-live="polite"><h3 className={`result-title verdict ${verdictClass}`}>{verdictLabel(result.verdict)} {result.executionTimeMs != null && <span className="muted" style={{ fontSize:12, fontWeight:500 }}>· {result.executionTimeMs} ms</span>}</h3>{result.message && <p className="muted" style={{ margin:"0 0 8px", fontSize:13 }}>{result.message}</p>}{result.errorMessage && <pre style={{ whiteSpace:"pre-wrap", color:"var(--muted)", fontSize:12 }}>{result.errorMessage}</pre>}{result.cases?.map(test => <div key={test.index} className="result-case"><strong style={{ color:test.passed?"var(--green)":"var(--red)" }}>{test.passed ? <Check size={14} style={{ display:"inline", verticalAlign:"-3px" }} /> : <X size={14} style={{ display:"inline", verticalAlign:"-3px" }} />} Test {test.index} {test.passed ? "passed" : "failed"} · {test.executionTimeMs} ms</strong><div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))", gap:9, marginTop:8 }}><div><span className="muted">Input</span><pre>{test.input}</pre></div><div><span className="muted">Expected</span><pre>{test.expectedOutput}</pre></div><div><span className="muted">Your output</span><pre>{test.actualOutput || "(no output)"}</pre></div></div></div>)}</div>}
    </> : <div style={{ padding:16 }}>{recent.length ? <div className="table-wrap"><table className="problems-table"><thead><tr><th>Verdict</th><th>Language</th><th>Time</th><th>Date</th></tr></thead><tbody>{recent.map(submission => <tr key={submission.id}><td><Link className={`verdict ${submission.verdict === "Accepted" ? "verdict-accepted" : "verdict-rejected"}`} href={`/submissions/${submission.id}`}>{submission.verdict}</Link></td><td>{submission.language === "python" ? "Python 3" : "C++17"}</td><td>{submission.execution_time_ms == null ? "—" : `${submission.execution_time_ms} ms`}</td><td>{formatDate(submission.created_at)}</td></tr>)}</tbody></table></div> : <div className="empty">Sign in and submit a solution to see your history here.<div style={{ marginTop:10 }}><Link className="button button-secondary button-sm" href="/login">Sign in</Link></div></div>}</div>}
    <div className="editor-footer"><span>Python 3.13 · GNU C++17</span><Badge>Network disabled in judge</Badge></div>
  </section>;
}
