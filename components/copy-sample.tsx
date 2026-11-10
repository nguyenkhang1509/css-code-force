"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CopySample({ label, value }: { label: string; value: string }) {
  const [status, setStatus] = useState<"idle" | "copied" | "error">("idle");

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setStatus("copied");
    } catch {
      setStatus("error");
    }
    window.setTimeout(() => setStatus("idle"), 1800);
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
        <span className="muted" style={{ fontSize: 11 }}>{label}</span>
        <Button type="button" variant="ghost" size="sm" onClick={copy} aria-label={`Copy ${label.toLowerCase()}`}>
          {status === "copied" ? <Check size={13} /> : <Copy size={13} />}
          {status === "copied" ? "Copied" : status === "error" ? "Copy failed" : "Copy"}
        </Button>
      </div>
      <pre>{value}</pre>
      <span className="sr-only" aria-live="polite">{status === "copied" ? `${label} copied` : status === "error" ? `Could not copy ${label.toLowerCase()}` : ""}</span>
    </div>
  );
}
