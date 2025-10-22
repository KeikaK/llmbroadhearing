import fs from "fs/promises";
import path from "path";
import React from "react";
import styles from "./page.module.css";

type Message = { role?: string; content?: string; text?: string; time?: string; sender?: string };

export default async function SessionPage({ params }: { params: any }) {
  // Next.js の params は Promise の場合があるため await して使う
  const { file: rawFile } = await params;
  const safeFile = (String(rawFile ?? "")).endsWith(".json") ? String(rawFile) : `${String(rawFile ?? "")}.json`;
  const dataDir = path.join(process.cwd(), "data", "sessions");
  const filePath = path.join(dataDir, safeFile);

  let json: any = null;
  try {
    const txt = await fs.readFile(filePath, "utf8");
    json = JSON.parse(txt);
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

  const messages: Message[] = Array.isArray(json.messages) ? json.messages : (json.messages ?? []);
  const aiModel = String(json?.question?.ai_model ?? json?.question?.model ?? json?.ai_model ?? json?.model ?? "不明");

  return (
    <main className={styles.main}>
      <div className={styles.container}>
        <header className={`${styles.header} ${styles.sessionHeader}`}>
          <h1 className={styles.title}>{json.title ?? json.name ?? "セッション"}</h1>
          <div className={styles.sessionMetaRow}>
            <div className={styles.sessionFile}>ファイル: {safeFile}</div>
            <div className={styles.sessionModelPill}>モデル: {aiModel}</div>
          </div>
        </header>

        <div style={{ marginTop: 12 }}>
          <div className={styles.sessionContentWrap}>
            <div className={styles.sessionContentCard}>
              {/* 全データを先に表示 */}
              <details className={styles.jsonDump}>
                <summary style={{ cursor: "pointer", fontWeight: 700, color: "#7f1d1d" }}>全データを表示</summary>
                <pre className={styles.jsonPre}>
                  {JSON.stringify(json, null, 2)}
                </pre>
              </details>

              {/* セッション情報表示 */}
              <section className={styles.metaGrid} aria-labelledby="session-meta" style={{ marginBottom: 16 }}>
                <h3 id="session-meta" style={{ margin: "0 0 10px 0", fontSize: 14, fontWeight: 800, color: "#7f1d1d" }}>セッション情報</h3>

                {/* トップレベルの簡易キー表示（messages と question は個別に扱う） */}
                <div className={styles.kvList}>
                  {Object.entries(json).filter(([k]) => k !== "messages" && k !== "question").map(([k, v]) => (
                    <div className={styles.kvRow} key={k}>
                      <div className={styles.kvKey}>{k}</div>
                      <div className={styles.kvVal}>
                        {v === null || v === undefined ? <em style={{ color: "#7f7f7f" }}>null</em> :
                          (typeof v === "object" ? (
                            <details>
                              <summary style={{ cursor: "pointer" }}>オブジェクトを表示</summary>
                              <pre className={styles.jsonPre} style={{ marginTop: 8 }}>{JSON.stringify(v, null, 2)}</pre>
                            </details>
                          ) : String(v))
                        }
                      </div>
                    </div>
                  ))}
                </div>

                {/* question オブジェクトをキー/値で表示 */}
                {json.question && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontWeight: 800, color: "#5b1313", marginBottom: 8 }}>question</div>
                    <div className={styles.kvList}>
                      {Object.entries(json.question).map(([k, v]) => (
                        <div className={styles.kvRow} key={k}>
                          <div className={styles.kvKey}>{k}</div>
                          <div className={styles.kvVal}>{v === null || v === undefined ? <em style={{ color: "#7f7f7f" }}>null</em> : (typeof v === "object" ? <pre className={styles.jsonPre}>{JSON.stringify(v, null, 2)}</pre> : String(v))}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>

              {/* 会話表示（JSON 全データの下に配置） */}
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
    </main>
  );
}