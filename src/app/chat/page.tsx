"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import styles from "./page.module.css";
import SimpleMarkdown from "../../components/SimpleMarkdown";

/**
 * Msg 型
 * - id: 各メッセージの一意識別子（レンダリング key や更新時の判定に使用）
 * - role: "user" | "assistant"
 * - content: 表示するテキスト本体
 * - at: 表示用の時刻文字列 (例: "12:34:56")
 */
type Msg = { id: string; role: "user" | "assistant"; content: string; at: string };

/* ---------- 小さな UI コンポーネント：Toast, ConfirmModal ---------- */

/**
 * Toast：短時間の通知表示
 * - open が true のとき自動でタイムアウト閉じ (2800ms)
 * - type により色を切り替える（info / success / error）
 */
function Toast({
  open,
  type = "info",
  message,
  onClose,
}: {
  open: boolean;
  type?: "info" | "success" | "error";
  message: string;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(onClose, 2800);
    return () => clearTimeout(t);
  }, [open, onClose]);

  if (!open) return null;

  const variantClass =
    type === "success"
      ? styles.toastSuccess
      : type === "error"
      ? styles.toastError
      : styles.toastInfo;

  return (
    <div className={`${styles.toast} ${variantClass}`}>
      <div className={styles.toastMsg}>{message}</div>
      <button
        className={styles.toastClose}
        onClick={onClose}
        aria-label="閉じる"
      >
        ×
      </button>
    </div>
  );
}

/**
 * ConfirmModal：汎用の確認ダイアログ
 * - open: 表示制御
 * - loading: 保存などの処理中はボタンを無効化
 * - onConfirm/onCancel: コールバック
 */
function ConfirmModal({
  open,
  title,
  body,
  confirmText = "保存する",
  cancelText = "キャンセル",
  loading = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body?: string;
  confirmText?: string;
  cancelText?: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalCard}>
        <h3 className={styles.modalTitle}>{title}</h3>
        {body && <p className={styles.modalBody}>{body}</p>}
        <div className={styles.modalActions}>
          <button
            className={styles.btnGhost}
            onClick={onCancel}
            disabled={loading}
          >
            {cancelText}
          </button>
          <button
            className={styles.btnPrimary}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? "保存中…" : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- メインコンポーネント: ChatPage ---------- */
export default function ChatPage() {
  // メッセージ配列（画面表示用）
  const [messages, setMessages] = useState<Msg[]>([]);

  // クエリの question を読み、該当テンプレ情報を取得してタイトルやモデルを表示
  const searchParams = useSearchParams();
  const questionParam = searchParams?.get("question") ?? null;
  const [questionMeta, setQuestionMeta] = useState<{
    id: string;
    title: string;
    description?: string;
    raw?: any;
    ai_model?: string;
  } | null>(null);

  // questionParam に基づきテンプレを読み込む（初回マウント後）
  useEffect(() => {
    if (!questionParam) return;
    let mounted = true;
    (async () => {
      try {
        const res = await fetch("/api/questions");
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        if (!mounted) return;
        const found = Array.isArray(data) ? data.find((d: any) => String(d.id) === String(questionParam)) : null;
        if (found) {
          setQuestionMeta({
            id: String(found.id),
            title: String(found.title ?? "ヒアリング"),
            description: found.raw?.description ?? found.description ?? "",
            raw: found.raw ?? found,
            ai_model: found.raw?.ai_model ?? found.ai_model ?? undefined,
          });
        }
      } catch (e) {
        console.error("failed to load question meta", e);
      }
    })();
    return () => { mounted = false; };
  }, [questionParam]);

  // ドキュメントタイトルを questionMeta に合わせて更新
  useEffect(() => {
    if (questionMeta?.title) {
      document.title = `${questionMeta.title} — LLMBroadHearing`;
    } else {
      document.title = "ヒアリング — LLMBroadHearing";
    }
  }, [questionMeta]);

  /* ---------- UI / 操作用 state ---------- */
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false); // API 呼び出し全体のローディング
  const [saving, setSaving] = useState(false); // 保存処理中
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<"save" | "discard">("save");
  const [toast, setToast] = useState<{ open: boolean; type: "info" | "success" | "error"; msg: string }>({ open: false, type: "info", msg: "" });

  // ストリーミング中（最初のチャンク受信前）にスピナーを表示するメッセージ id
  const [streamingAt, setStreamingAt] = useState<string | null>(null);

  /* refs */
  const listRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const composerRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  // メッセージ更新時にスクロール（下部へ）
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  // 表示用の時刻文字列生成ヘルパー（時:分:秒）
  const now = () =>
    new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });

  /**
   * sendImpl: 実際の送信処理（UI 表示と API 呼び出しの扱いを分離）
   * - ユーザメッセージを追加
   * - アシスタント用のプレースホルダを追加してスピナーを表示
   * - fetch で /api/chat を呼び、ストリーミングがあれば逐次追記する
   */
  const sendImpl = async (text: string) => {
    const userMsg: Msg = { id: String(Date.now()), role: "user", content: text.trim(), at: now() };
    const assistantId = String(Date.now() + Math.floor(Math.random() * 1000));
    const assistantPlaceholder: Msg = { id: assistantId, role: "assistant", content: "", at: "" };

    // ローカル表示用にユーザとプレースホルダを追加
    setMessages((prev) => [...prev, userMsg, assistantPlaceholder]);

    // API に送る履歴（ローカル state messages は非同期なので直接参照は慎重に）
    // ここでは直近の messages を使わず userMsg を含めた配列を組み立てて送る
    const messagesForApi = [...messages, userMsg];

    setStreamingAt(assistantId);
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: messagesForApi, question: questionParam }),
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText);
      }

      // ストリーミング対応：ReadableStream を逐次読み出す処理
      if (res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let firstChunk = true;
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          // プレースホルダの content にチャンクを追記
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + chunk } : m))
          );
          // 最初のチャンク到着時にスピナーを消す
          if (firstChunk) {
            setStreamingAt(null);
            firstChunk = false;
          }
        }
        // ストリーム完了時に時刻を更新
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, at: now() } : m))
        );
        setStreamingAt(null);
      } else {
        // 非ストリーミング応答（JSON or text）
        const data = await res.json();
        const reply = (data?.reply ?? data?.error ?? "（応答なし）").toString();
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content: reply, at: now() } : m))
        );
        setStreamingAt(null);
      }
    } catch (err: any) {
      // エラー時はプレースホルダをエラーメッセージに置換
      setStreamingAt(null);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: `Error: ${err?.message ?? String(err)}`, at: now() }
            : m
        )
      );
    } finally {
      setLoading(false);
    }
  };

  // フォーム送信ハンドラ
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;
    const text = input;
    setInput("");
    await sendImpl(text);
    taRef.current?.focus();
  };

  /* ---------- Composer の高さ同期（CSS 変数に反映） ---------- */
  const syncComposerHeightVar = () => {
    const h = composerRef.current?.offsetHeight ?? 72;
    document.documentElement.style.setProperty("--composer-h", `${h}px`);
  };

  const autoResize = (el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    const maxH = 200;
    el.style.height = Math.min(el.scrollHeight, maxH) + "px";
    el.style.overflowY = el.scrollHeight > maxH ? "auto" : "hidden";
    syncComposerHeightVar();
  };

  useEffect(() => {
    syncComposerHeightVar();
    window.addEventListener("resize", syncComposerHeightVar);
    return () => window.removeEventListener("resize", syncComposerHeightVar);
  }, []);
  useEffect(() => {
    if (taRef.current) autoResize(taRef.current);
  }, [input]);

  /* ---------- 保存確認ダイアログ制御 ---------- */
  const openConfirm = (action: "save" | "discard" = "save") => {
    setConfirmAction(action);
    setConfirmOpen(true);
  };

  // ConfirmModal の「確定」ボタン処理
  const handleConfirm = async () => {
    if (confirmAction === "save") {
      await confirmAndSave();
      return;
    }
    setConfirmOpen(false);
    router.back();
  };

  /**
   * confirmAndSave:
   * - テンプレ情報を取得して payload に含める（存在すれば）
   * - まずは要約なしで即保存（UI ブロックを避ける）
   * - 保存完了後に非同期で要約生成を依頼
   */
  const confirmAndSave = async () => {
    setSaving(true);
    try {
      let questionJson: any = null;
      if (questionParam) {
        try {
          const qres = await fetch("/api/questions");
          if (qres.ok) {
            const qdata = await qres.json();
            const found = Array.isArray(qdata)
              ? qdata.find((d: any) => String(d.id) === String(questionParam))
              : null;
            questionJson = found?.raw ?? found ?? null;
          }
        } catch (e) {
          console.warn("confirmAndSave: failed to fetch question json", e);
        }
      }

      const payload = {
        exportedAt: new Date().toISOString(),
        messages,
        question: questionJson,
        summary: null, // 後で生成
      };
      const res = await fetch("/api/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json?.ok) {
        setToast({
          open: true,
          type: "error",
          msg: json?.message || "保存に失敗しました",
        });
        return;
      }

      setToast({
        open: true,
        type: "success",
        msg: `保存しました：${json.file || ""}`,
      });
      setConfirmOpen(false);

      // バックグラウンドで要約生成をリクエスト（UI を待たない）
      (async () => {
        try {
          await fetch("/api/save-summary", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              file: json.file,
              messages,
              question: questionJson,
            }),
          });
          console.log("background: summary generation requested");
        } catch (e) {
          console.warn("background: save-summary failed", e);
        }
      })();

      setTimeout(() => router.push("/"), 900);
    } finally {
      setSaving(false);
    }
  };

  /* ---------- 初期マウント時の自動呼び出し（初期 AI 応答） ---------- */
  useEffect(() => {
    // StrictMode 等での副作用二重実行を抑止する軽量なガード
    if (typeof window !== "undefined") {
      const last = (window as any).__chat_init_last ?? 0;
      const nowTs = Date.now();
      const SKIP_MS = 1000;
      if (nowTs - last < SKIP_MS) {
        return;
      }
      (window as any).__chat_init_last = nowTs;
    }

    const runOnMount = async () => {
      try {
        setLoading(true);
        const assistantId = String(Date.now() + Math.floor(Math.random() * 1000));
        setMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: "", at: "" }]);
        setStreamingAt(assistantId);

        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: [], question: questionParam }),
        });
        if (!res.ok) {
          const txt = await res.text();
          throw new Error(txt);
        }
        if (res.body) {
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let firstChunk = true;
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + chunk } : m))
            );
            if (firstChunk) {
              setStreamingAt(null);
              firstChunk = false;
            }
          }
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, at: now() } : m))
          );
          setStreamingAt(null);
        } else {
          const text = await res.text();
          let reply = text;
          try {
            const ct = (res.headers.get("content-type") || "").toLowerCase();
            if (ct.includes("application/json")) {
              const data = JSON.parse(text);
              reply = (data?.reply ?? data?.error ?? text).toString();
            }
          } catch {
            reply = text;
          }
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, content: reply, at: now() } : m))
          );
          setStreamingAt(null);
        }
      } catch (err: any) {
        setStreamingAt(null);
        setMessages((prev) =>
          prev.map((m) =>
            m.content === "" ? { ...m, content: `Error: ${err?.message ?? String(err)}`, at: now() } : m
          )
        );
        console.error("初期AI呼び出し失敗:", err);
      } finally {
        setLoading(false);
      }
    };

    runOnMount();
  }, []);

  /* ---------- JSX: レイアウトと表示 ---------- */
  return (
    <div className={styles.wrap}>
      <header className={styles.header} style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {/* 左：タイトル + description */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div className={styles.title}>{questionMeta?.title ?? "ヒアリング"}</div>
          <div className={styles.subtitle}>
            {questionMeta?.raw?.description ?? questionMeta?.description ?? ""}
          </div>
        </div>

        {/* 右上：モデル表示（ヘッダ右上に固定） */}
        <div className={styles.modelWrapper}>
          <div className={styles.modelBadge}>
            model: {questionMeta?.raw?.ai_model ?? questionMeta?.ai_model ?? "既定"}
          </div>
        </div>

        {/* 右下（ヘッダ下底）：アクションボタン群 */}
        <div className={styles.headerActions} style={{ marginLeft: "auto", alignItems: "center", gap: 10 }}>
          <button
            className={styles.btnGhost}
            onClick={() => openConfirm("discard")}
            aria-label="保存せずに終了"
          >
            保存せずに終了
          </button>

          <button
            className={styles.endBtn}
            onClick={() => openConfirm("save")}
            aria-label="保存してヒアリングを終了"
          >
            保存してヒアリングを終了
          </button>
        </div>
      </header>

      {/* メッセージリスト */}
      <div
        ref={listRef}
        className={`${styles.list} ${messages.length === 0 ? styles.listEmpty : ""}`}
      >
        {messages.length === 0 ? (
          <div className={styles.empty}>メッセージを入力して開始してください。</div>
        ) : (
          messages.map((m) => {
           const mine = m.role === "user";
           return (
              <div
                key={m.id} /* id をキーにすることで安定した再レンダリング */
                className={`${styles.row} ${mine ? styles.me : styles.ai}`}
              >
                {!mine && (
                  <div className={styles.avatar}>
                    <img className={styles.myIcon} src="/ai.png" alt="AI" />
                  </div>
                )}
                <div className={`${styles.bubble} ${mine ? styles.meBubble : styles.aiBubble}`}>
                  <SimpleMarkdown content={m.content} className={styles.text} />

                  {/* streamingAt と一致するメッセージにスピナー表示 */}
                  {!mine && m.id === streamingAt && (
                    <span className={styles.spinner} aria-hidden="true" />
                  )}

                  <div className={`${styles.meta} ${mine ? styles.meMeta : styles.aiMeta}`}>
                    <span className={styles.time}>{m.at}</span>
                    {mine && <span className={styles.read}>既読</span>}
                  </div>
                </div>
                {mine && (
                  <div className={styles.avatar}>
                    <img src="/me.png" alt="Me" className={styles.myIcon} />
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Composer（入力エリア） */}
      <form ref={composerRef} className={styles.composer} onSubmit={onSubmit}>
        <div className={styles.avatar}>
          <img src="/me.png" alt="Me" className={styles.myIcon} />
        </div>
        <textarea
          ref={taRef}
          className={styles.textarea}
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            autoResize(e.currentTarget);
          }}
          onPaste={(e) =>
            requestAnimationFrame(() =>
              autoResize(e.currentTarget as HTMLTextAreaElement)
            )
          }
          placeholder="メッセージを入力してください"
          rows={1}
        />
        <button
          className={`${styles.iconBtn} ${styles.send}`}
          type="submit"
          disabled={loading}
        >
          ▶
        </button>
      </form>

      {/* 確認ダイアログと通知 */}
      <ConfirmModal
        open={confirmOpen}
        title={confirmAction === "save" ? "本当に保存して終了しますか？" : "保存せずに終了しますか？"}
        body={
          confirmAction === "save"
            ? "保存してヒアリングを終了すると、現在の内容が保存されます。続行しますか？"
            : "保存せずに終了すると、現在の入力内容は失われます。続行しますか？"
        }
        confirmText={confirmAction === "save" ? "保存する" : "保存せずに終了"}
        cancelText="キャンセル"
        loading={saving}
        onConfirm={handleConfirm}
        onCancel={() => setConfirmOpen(false)}
      />

      <Toast
        open={toast.open}
        type={toast.type}
        message={toast.msg}
        onClose={() => setToast((t) => ({ ...t, open: false }))}
      />
    </div>
  );
}
