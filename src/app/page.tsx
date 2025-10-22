"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import styles from "./page.module.css";

/* ---------- 型定義 ----------
   - QuestionItem: ヒアリングテンプレート一覧の要素
   - SessionItem: セッション一覧 API が返すメタ情報用
*/
type QuestionItem = { id: string; title: string; description?: string; raw?: any };
type SessionItem = {
  file: string;
  exportedAt?: string | null;
  questionTitle?: string | null;
  summary?: string | null;
  ai_model?: string | null;
};

/* ---------- インラインスタイル：カードの基礎定義 ----------
   - 既存コードで使われる見た目を JS オブジェクトで定義（JSX 内で使用）
   - GUI 表示に関する注釈のみ。ロジックには影響しません。
*/
const questionCardBase: React.CSSProperties = {
  padding: 20,
  borderRadius: 16,
  background: "#ffffff",
  border: "1px solid rgba(4,81,47,0.08)",
  boxShadow: "0 18px 40px rgba(6,199,85,0.09)",
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
  borderLeft: "8px solid #059669",
  paddingLeft: 16,
  backgroundImage: "linear-gradient(90deg, rgba(5,150,105,0.02), transparent)",
};

const sessionCardBase: React.CSSProperties = {
  padding: 14,
  borderRadius: 12,
  background: "linear-gradient(180deg,#f6fbff,#ffffff)",
  border: "1px solid rgba(6,106,255,0.08)",
  minHeight: 96,
  display: "flex",
  flexDirection: "column",
  gap: 8,
  boxShadow: "0 10px 24px rgba(6,106,255,0.06)",
};
const sessionAccent = { borderLeft: "6px solid #06a6ff", paddingLeft: 12 };

const qTitleStyle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 800,
  color: "#033027",
  marginBottom: 4,
};
const qDescStyle: React.CSSProperties = {
  fontSize: 14,
  color: "#134e3a",
  lineHeight: 1.45,
  opacity: 0.95,
};

/* ---------- Home コンポーネント ----------
   - 質問テンプレート一覧と保存済みセッション一覧を取得して表示する
   - fetch はクライアントサイドで行い、マウント判定 (mounted) でメモリリークを防止
*/
export default function Home() {
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [sessions, setSessions] = useState<SessionItem[]>([]);

  /* 質問テンプレートの取得（初回マウント） */
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch("/api/questions");
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        if (!mounted) return;
        if (Array.isArray(data)) {
          // API の各エントリから表示に必要なプロパティを抽出
          setQuestions(
            data.map((d: any) => ({
              id: String(d.id),
              title: String(d.title ?? "untitled"),
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
      mounted = false; // クリーンアップして非同期コールバックの副作用を防ぐ
    };
  }, []);

  /* 保存済みセッション一覧の取得（初回マウント） */
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

  /* ---------- JSX: レイアウト ----------
     - 左上にタイトル
     - テンプレ一覧（questions）: Link で /chat?question=ID へ遷移
     - セッション一覧（sessions）: Link で /sessions/<file> を新タブで開く
     - 管理ボタンは /admin/questions へ移動
  */
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
                /* 各テンプレは Link でチャットページに遷移 */
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

        {/* 回答（セッション）セクション */}
        <section className={styles.sessionSection}>
          <div className={styles.sessionLabel}>回答内容</div>

          {sessions.length === 0 ? (
            <div className={styles.sessionEmpty}>保存済みのセッションがありません</div>
          ) : (
            <div className={styles.sessionGrid}>
              {sessions.map((s) => (
                /* セッションは別タブで開く（安全のため noopener を指定） */
                <Link
                  key={s.file}
                  href={`/sessions/${encodeURIComponent(s.file)}`}
                  className={styles.cardLink}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <div data-debug="session-card" className={`${styles.sessionCard} ${styles.sessionAccent}`} role="button">
                    <div className={styles.sessionTitle}>{s.questionTitle ?? "（無題）"}</div>
                    <div className={styles.sessionMeta}>
                      {s.exportedAt ? `${new Date(s.exportedAt).toLocaleString()} に回答済` : ""}
                    </div>
                    <div className={styles.sessionSummary}>{s.summary ?? "要約なし"}</div>
                    <div className={styles.sessionModel}>{s.ai_model ? `model: ${s.ai_model}` : ""}</div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* 管理ボタン */}
        <div className={styles.actionsWrap}>
          <Link href="/admin/questions" className={styles.linkReset}>
            <button className={styles.adminBtn} aria-label="テンプレート管理へ移動">テンプレート管理</button>
          </Link>
        </div>
      </div>
    </main>
  );
}
