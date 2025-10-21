"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

type QuestionItem = { id: string; title: string; description?: string; raw?: any };
type SessionItem = {
  file: string;
  exportedAt?: string | null;
  questionTitle?: string | null;
  summary?: string | null;
  ai_model?: string | null;
};

// ヒアリング一覧カード（緑系アクセントを強調）
const questionCardBase: React.CSSProperties = {
  padding: 18,
  borderRadius: 14,
  background: "linear-gradient(180deg,#f7fff9,#ffffff)", // 薄い緑トーン背景
  border: "1px solid rgba(6,199,85,0.08)",
  boxShadow: "0 10px 28px rgba(6,199,85,0.06)",
  cursor: "pointer",
  display: "flex",
  flexDirection: "column",
  gap: 8,
  minHeight: 110,
  alignItems: "flex-start",
  position: "relative",
  overflow: "hidden",
};
const questionAccent = { borderLeft: "6px solid #06c755", paddingLeft: 14 };

// 回答内容カード（青系アクセントで明確に分離）
const sessionCardBase: React.CSSProperties = {
  padding: 14,
  borderRadius: 12,
  background: "linear-gradient(180deg,#f6fbff,#ffffff)", // 薄い青トーン背景
  border: "1px solid rgba(6,106,255,0.08)",
  minHeight: 96,
  display: "flex",
  flexDirection: "column",
  gap: 8,
  boxShadow: "0 10px 24px rgba(6,106,255,0.06)",
};
const sessionAccent = { borderLeft: "6px solid #06a6ff", paddingLeft: 12 };

export default function Home() {
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [sessions, setSessions] = useState<SessionItem[]>([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch("/api/questions");
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        if (!mounted) return;
        if (Array.isArray(data)) {
          setQuestions(
            data.map((d: any) => ({
              id: String(d.id),
              title: String(d.title ?? "untitled"),
              // JSON 内の description を確実に拾う（raw の中やトップレベルの両方を確認）
              description: String(
                d.raw?.description ??
                  d.description ??
                  d.raw?.desc ??
                  d.desc ??
                  ""
              ),
              raw: d.raw ?? d,
            }))
          );
        }
      } catch (e) {
        console.error("failed to load questions", e);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch("/api/sessions");
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        if (!mounted) return;
        if (Array.isArray(data)) setSessions(data);
      } catch (e) {
        console.warn("failed to load sessions", e);
      }
    })();
    return () => { mounted = false; };
  }, []);

  return (
    <main style={{ minHeight: "100svh", background: "#eef2f6", padding: 24 }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        {/* ヘッダ */}
        <header style={{ padding: "8px 12px 18px", display: "flex", alignItems: "center", gap: 12 }}>
          <h1
            style={{
              margin: 0,
              fontSize: 40,
              fontWeight: 800,
              background: "linear-gradient(90deg, #06c755, #06a6ff)",
              WebkitBackgroundClip: "text" as any,
              WebkitTextFillColor: "transparent" as any,
              backgroundClip: "text" as any,
              color: "transparent",
            }}
          >
            LLM BROAD HEARING
          </h1>
        </header>

        <hr style={{ border: "none", borderTop: "1px solid rgba(15,23,42,0.06)", margin: "8px 0 18px" }} />

        {/* ヒアリング一覧（ラベルを最上段に置き、パネルはその直下の別行に表示） */}
        <section style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 20 }}>
          {/* ラベル：最上段で全幅に表示（左カラムの位置に視覚的に揃う） */}
          <div style={{ gridColumn: "1 / -1", color: "#0f172a", fontSize: 20, fontWeight: 700, paddingTop: 6 }}>
            ヒアリング一覧
          </div>

          {/* パネル群：ラベルの直下の別行に配置（必要なら右側のみ表示に変更可） */}
          <div style={{ gridColumn: "1 / -1" }}>
            <div style={{
              display: "grid",
              // 1行につき最大2列に制限（小さな画面では幅に合わせて潰れる）
              gridTemplateColumns: "repeat(2, minmax(220px, 1fr))",
              gap: 16,
              alignItems: "start",
            }}>
               {questions.length === 0 ? (
                 <div style={{ gridColumn: "1 / -1", padding: 16, borderRadius: 12, background: "#fbfdff", border: "1px dashed #e6eef8", color: "#9ca3af" }}>
                   テンプレートがありません（data/questions を確認）
                 </div>
               ) : questions.map(q => (
                 <Link key={q.id} href={`/chat?question=${encodeURIComponent(q.id)}`} style={{ textDecoration: "none" }}>
                   <div role="button" tabIndex={0}
                     style={{ ...questionCardBase, ...questionAccent, transition: "transform .12s ease" }}
                     onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.transform = "translateY(-6px)"; (e.currentTarget as HTMLDivElement).style.boxShadow = "0 18px 36px rgba(6,25,50,0.12)"; }}
                     onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.transform = ""; (e.currentTarget as HTMLDivElement).style.boxShadow = "0 6px 18px rgba(6,25,50,0.04)"; }}
                   >
                     <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a" }}>{q.title}</div>
                     <div style={{ fontSize: 13, color: "#475569", lineHeight: 1.4, opacity: 0.9 }}>
                       {q.description || "説明がありません"}
                     </div>
                     <div style={{ marginTop: "auto", fontSize: 12, color: "#9ca3af" }}>選択してチャットを開始</div>
                   </div>
                 </Link>
               ))}
             </div>
           </div>
         </section>

        <hr style={{ border: "none", borderTop: "1px solid rgba(15,23,42,0.04)", margin: "22px 0" }} />

        {/* 回答内容：/data/sessions の保存セッションをカード表示（青系で区別） */}
        <section style={{ background: "linear-gradient(180deg,#f2f9ff,#fff)", borderRadius: 12, border: "1px solid rgba(6,106,255,0.06)", padding: 18, minHeight: 280, boxShadow: "0 12px 36px rgba(6,106,255,0.04)" }}>
          <div style={{ color: "#0f4aa6", fontSize: 14, fontWeight: 700, marginBottom: 12 }}>回答内容</div>

          {sessions.length === 0 ? (
            <div style={{ color: "#6b7280" }}>保存済みのセッションがありません</div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
              {sessions.map((s) => (
                <div key={s.file} style={{ ...sessionCardBase, ...sessionAccent }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: "#08306b" }}>{s.questionTitle ?? "（無題）"}</div>
                  <div style={{ fontSize: 12, color: "#2b6cb0" }}>
                    {s.exportedAt ? `${new Date(s.exportedAt).toLocaleString()} に回答済` : ""}
                  </div>
                  <div style={{ fontSize: 13, color: "#08303b", marginTop: 8, lineHeight: 1.4, flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>
                    {s.summary ?? "要約なし"}
                  </div>
                  <div style={{ fontSize: 12, color: "#3b82f6", marginTop: 8 }}>{s.ai_model ? `model: ${s.ai_model}` : ""}</div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
