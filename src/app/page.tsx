"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import styles from "./page.module.css";
type QuestionItem = { id: string; title: string; description?: string; raw?: any };
type SessionItem = {
  file: string;
  exportedAt?: string | null;
  questionTitle?: string | null;
  summary?: string | null;
  ai_model?: string | null;
};

// ヒアリング一覧カード（強調版：よりコントラスト高く目立たせる）
const questionCardBase: React.CSSProperties = {
  padding: 20,
  borderRadius: 16,
  background: "#ffffff", // 真っ白で目立たせる
  border: "1px solid rgba(4,81,47,0.08)", // 緑寄りの明瞭な境界
  boxShadow: "0 18px 40px rgba(6,199,85,0.09)", // 強めの緑影で浮かせる
  cursor: "pointer",
  display: "flex",
  flexDirection: "column",
  gap: 10,
  minHeight: 130,
  alignItems: "flex-start",
  position: "relative",
  overflow: "hidden",
  transition: "transform .16s ease, box-shadow .16s ease",
};
const questionAccent = {
  borderLeft: "8px solid #059669", // 太めのアクセントライン
  paddingLeft: 16,
  backgroundImage: "linear-gradient(90deg, rgba(5,150,105,0.02), transparent)", // 左側に薄いトーンを追加
};

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

// カード内のタイトル／説明スタイル（レンダー内で使用）
const qTitleStyle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 800,
  color: "#033027", // 濃い緑で視認性向上
  marginBottom: 4,
};
const qDescStyle: React.CSSProperties = {
  fontSize: 14,
  color: "#134e3a", // 説明も少し濃く
  lineHeight: 1.45,
  opacity: 0.95,
};

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
    <main className={styles.main}>
      <div className={styles.container}>
        {/* ヘッダ */}
        <header className={styles.header}>
          <h1 className={styles.title}>LLM BROAD HEARING</h1>
        </header>

        <hr className={styles.hr} />

        {/* ヒアリング一覧 */}
        <section className={styles.sectionGrid}>
          <div className={styles.sectionLabel}>ヒアリング一覧</div>

          <div className={styles.questionsPanel}>
            <div className={styles.questionGrid}>
              {questions.length === 0 ? (
                <div className={styles.empty}>テンプレートがありません（data/questions を確認）</div>
              ) : questions.map((q) => (
                <Link key={q.id} href={`/chat?question=${encodeURIComponent(q.id)}`} className={styles.cardLink}>
                  <div role="button" tabIndex={0} className={`${styles.questionCard} ${styles.questionAccent}`}>
                    <div className={styles.qTitle}>{q.title}</div>
                    <div className={styles.qDesc}>{q.description || "説明がありません"}</div>
                    <div className={styles.cardMeta}>選択してチャットを開始</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <hr className={styles.hrLight} />

        <section className={styles.sessionSection}>
          <div className={styles.sessionLabel}>回答内容</div>

          {sessions.length === 0 ? (
            <div className={styles.sessionEmpty}>保存済みのセッションがありません</div>
          ) : (
            <div className={styles.sessionGrid}>
              {sessions.map((s) => (
                <div key={s.file} className={`${styles.sessionCard} ${styles.sessionAccent}`}>
                  <div className={styles.sessionTitle}>{s.questionTitle ?? "（無題）"}</div>
                  <div className={styles.sessionMeta}>
                    {s.exportedAt ? `${new Date(s.exportedAt).toLocaleString()} に回答済` : ""}
                  </div>
                  <div className={styles.sessionSummary}>{s.summary ?? "要約なし"}</div>
                  <div className={styles.sessionModel}>{s.ai_model ? `model: ${s.ai_model}` : ""}</div>
                </div>
              ))}
            </div>
          )}
        </section>

        <div className={styles.actionsWrap}>
          <Link href="/admin/questions" className={styles.linkReset}>
            <button className={styles.adminBtn} aria-label="テンプレート管理へ移動">テンプレート管理</button>
          </Link>
        </div>
      </div>
    </main>
  );
}
