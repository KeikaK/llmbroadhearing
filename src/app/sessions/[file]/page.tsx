import React from "react";
import styles from "./page.module.css";
import type { SessionFile, Message } from "../../../types/session";
import { readSessionFile, ensureJsonFilename } from "../../../lib/session";

export default async function SessionPage({ params }: { params: any }) {
  const { file: rawFile } = await params;
  const safeFile = String(rawFile ?? "");
  let json: SessionFile | null = null;

  try {
    json = await readSessionFile(safeFile);
  } catch (err: any) {
    return (
      <main className={styles.main}>
        <div className={styles.container}>
          <header className={styles.header}>
            <h1 className={styles.title}>セッション表示</h1>
          </header>
          <div style={{ padding: 24 }}>
            <h2 style={{ color: "#b91c1c" }}>読み込みエラー</h2>
            <div>ファイルを読み込めませんでした: {safeFile}</div>
            <pre style={{ marginTop: 12, whiteSpace: "pre-wrap" }}>{String(err?.message ?? err)}</pre>
          </div>
        </div>
      </main>
    );
  }

  const messages: Message[] = Array.isArray(json?.messages) ? json!.messages! : [];
  const aiModel = String(json?.question?.ai_model ?? json?.question?.model ?? json?.ai_model ?? json?.model ?? "不明");

  // トップレベルのメタ（messages, question を除外）
  const metaEntries = Object.entries(json ?? {}).filter(([k]) => k !== "messages" && k !== "question");

  return (
    <main className={styles.main}>
      <div className={styles.container}>
        <header className={`${styles.header} ${styles.sessionHeader}`}>
          <h1 className={styles.title}>{json?.title ?? json?.name ?? "セッション"}</h1>
          <div className={styles.sessionMetaRow}>
            <div className={styles.sessionFile}>ファイル: {ensureJsonFilename(safeFile)}</div>
            <div className={styles.sessionModelPill}>モデル: {aiModel}</div>
          </div>
        </header>

        <div style={{ marginTop: 12 }}>
          <div className={styles.sessionContentWrap}>
            <div className={styles.sessionContentCard}>
              {/* メタ情報を分割表示 */}
              <section className={styles.metaGrid} aria-labelledby="session-meta">
                <h3 id="session-meta" style={{ margin: "0 0 10px 0", fontSize: 14, fontWeight: 800, color: "#7f1d1d" }}>
                  セッション情報
                </h3>

                <div className={styles.kvList}>
                  {metaEntries.map(([k, v]) => (
                    <div className={styles.kvRow} key={k}>
                      <div className={styles.kvKey}>{k}</div>
                      <div className={styles.kvVal}>
                        {v === null || v === undefined ? (
                          <em style={{ color: "#7f7f7f" }}>null</em>
                        ) : typeof v === "object" ? (
                          <details>
                            <summary style={{ cursor: "pointer" }}>オブジェクトを表示</summary>
                            <pre className={styles.jsonPre}>{JSON.stringify(v, null, 2)}</pre>
                          </details>
                        ) : (
                          String(v)
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {json?.question && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontWeight: 800, color: "#5b1313", marginBottom: 8 }}>question</div>
                    <div className={styles.kvList}>
                      {Object.entries(json.question).map(([k, v]) => (
                        <div className={styles.kvRow} key={k}>
                          <div className={styles.kvKey}>{k}</div>
                          <div className={styles.kvVal}>
                            {v === null || v === undefined ? (
                              <em style={{ color: "#7f7f7f" }}>null</em>
                            ) : typeof v === "object" ? (
                              <pre className={styles.jsonPre}>{JSON.stringify(v, null, 2)}</pre>
                            ) : (
                              String(v)
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>

              {/* 折りたたみで生JSONも残す（必要なら） */}
              <details className={styles.jsonDump} style={{ marginTop: 16 }}>
                <summary style={{ cursor: "pointer", fontWeight: 700, color: "#7f1d1d" }}>生データを表示</summary>
                <pre className={styles.jsonPre} style={{ marginTop: 10 }}>
                  {JSON.stringify(json, null, 2)}
                </pre>
              </details>

              {/* 会話表示 */}
              <div style={{ marginTop: 18 }}>
                {messages.length === 0 ? (
                  <div style={{ color: "#6b1111" }}>会話がありません</div>
                ) : (
                  <div className={styles.conversationWrap}>
                    {messages.map((m, i) => {
                      const role = String(m.role ?? m.sender ?? "assistant");
                      const isUser = role === "user" || role === "client";
                      const content = String(m.content ?? m.text ?? "");
                      return (
                        <div key={i} className={isUser ? styles.msgRowUser : styles.msgRowAssistant}>
                          <div className={isUser ? styles.msgBubbleUser : styles.msgBubbleAssistant}>
                            <div className={styles.msgText}>{content}</div>
                            {m.time && <div className={styles.msgTime}>{new Date(m.time).toLocaleString()}</div>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}