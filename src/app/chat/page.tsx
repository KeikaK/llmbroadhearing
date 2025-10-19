"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./page.module.css";

type Msg = { role: "user" | "assistant"; content: string; at?: string };

/* ---------- Toast (右下通知) ---------- */
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
  return (
    <div className={`${styles.toast} ${styles[`toast_${type}`]}`}>
      <div className={styles.toastMsg}>{message}</div>
      <button className={styles.toastClose} onClick={onClose} aria-label="閉じる">
        ×
      </button>
    </div>
  );
}

/* ---------- Confirm Modal (HTML製ダイアログ) ---------- */
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
    <div className={styles.modalOverlay} role="dialog" aria-modal="true">
      <div className={styles.modalCard}>
        <h3 className={styles.modalTitle}>{title}</h3>
        {body && <p className={styles.modalBody}>{body}</p>}
        <div className={styles.modalActions}>
          <button className={styles.btnGhost} onClick={onCancel} disabled={loading}>
            {cancelText}
          </button>
          <button className={styles.btnPrimary} onClick={onConfirm} disabled={loading}>
            {loading ? "保存中…" : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [toast, setToast] = useState<{ open: boolean; type: "info" | "success" | "error"; msg: string }>({
    open: false,
    type: "info",
    msg: "",
  });

  const listRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const router = useRouter();

  /* 新メッセージでチャット欄のスクロールを最下部へ */
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages]);

  const now = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const sendImpl = async (text: string) => {
    const userMsg: Msg = { role: "user", content: text.trim(), at: now() };
    const next = [...messages, userMsg];
    setMessages(next);
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      const data = await res.json();
      const reply = (data?.reply ?? data?.error ?? "（応答なし）").toString();
      setMessages((prev) => [...prev, { role: "assistant", content: reply, at: now() }]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Request failed: ${err?.message ?? String(err)}`, at: now() },
      ]);
    } finally {
      setLoading(false);
    }
  };

  /* 送信（ボタンのみ。Enterでは送信しない） */
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;
    const text = input;
    setInput("");
    await sendImpl(text);
    taRef.current?.focus();
  };

  /* textarea 高さ自動調整 */
  const autoResize = (el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  };
  useEffect(() => {
    if (taRef.current) autoResize(taRef.current);
  }, [input]);

  /* 右上ボタン → モーダルを開く */
  const openConfirm = () => {
    if (messages.length === 0) {
      setToast({ open: true, type: "info", msg: "保存するメッセージがありません。" });
      return;
    }
    setConfirmOpen(true);
  };

  /* モーダルで「保存する」→ サーバ保存 → 成功トースト → 遷移 */
  const confirmAndSave = async () => {
    setSaving(true);
    try {
      const d = new Date();
      const payload = {
        app: "LLMBroadHearing",
        version: 1,
        exportedAt: d.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        messages,
        meta: { note: "アンケート深掘りの全メッセージログ" },
      };

      const res = await fetch("/api/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();

      if (!json?.ok) {
        setToast({ open: true, type: "error", msg: `保存に失敗しました: ${json?.error ?? "unknown"}` });
        return;
      }

      setToast({ open: true, type: "success", msg: `保存しました：${json.file}` });
      setConfirmOpen(false);
      setTimeout(() => router.push("/"), 900); // トーストを少し見せてから遷移
    } catch (e: any) {
      setToast({ open: true, type: "error", msg: `保存中にエラー: ${e?.message ?? e}` });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <div className={styles.title}>LLMBroadHearing – Survey Deep-Dive Bot</div>
        <div className={styles.headerActions}>
          <button className={styles.endBtn} onClick={openConfirm} disabled={saving}>
            保存してヒアリングを終了
          </button>
        </div>
      </header>

      {/* 上下2段：上=チャット欄（中央開始・スクロール領域）、下=入力欄（常に最下部） */}
      <div className={styles.contentSingle}>
        <div className={styles.main}>
          <div
            className={`${styles.list} ${messages.length === 0 ? styles.listEmpty : ""}`}
            ref={listRef}
          >
            {messages.length === 0 ? (
              <div className={styles.empty}>メッセージを入力して開始してください。</div>
            ) : (
              messages.map((m, i) => {
                const mine = m.role === "user";
                return (
                  <div className={`${styles.row} ${mine ? styles.me : styles.ai}`} key={i}>
                    {/* AIアイコン（左） */}
                    {!mine && (
                      <div className={styles.avatar} aria-hidden>
                        <svg viewBox="0 0 24 24" width="28" height="28">
                          <circle cx="12" cy="8" r="4" />
                          <path d="M4 20c0-4.4 3.6-8 8-8s8 3.6 8 8" />
                        </svg>
                      </div>
                    )}

                    {/* 吹き出し */}
                    <div className={`${styles.bubble} ${mine ? styles.meBubble : styles.aiBubble}`}>
                      <div className={styles.text}>{m.content}</div>
                      <div className={`${styles.meta} ${mine ? styles.meMeta : styles.aiMeta}`}>
                        <span className={styles.time}>{m.at ?? ""}</span>
                        {mine && <span className={styles.read}>既読</span>}
                      </div>
                    </div>

                    {/* ユーザーアイコン（右） */}
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

          {/* 入力欄（常に最下段） */}
          <form className={styles.composer} onSubmit={onSubmit}>
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
              onPaste={(e) => requestAnimationFrame(() => autoResize(e.currentTarget as HTMLTextAreaElement))}
              placeholder="メッセージを入力してください"
              rows={1}
            />

            <button
              className={`${styles.iconBtn} ${styles.send}`}
              type="submit"
              disabled={loading}
              aria-label="送信"
              title="送信"
            >
              <svg viewBox="0 0 24 24" width="22" height="22">
                <path d="M3 11l17-8-7 18-2-7-8-3z" />
              </svg>
            </button>
          </form>
        </div>
      </div>

      {/* 確認モーダル & トースト */}
      <ConfirmModal
        open={confirmOpen}
        title="保存してヒアリングを終了しますか？"
        body="JSONをサーバーに保存し、トップページに戻ります。"
        confirmText="保存する"
        cancelText="キャンセル"
        loading={saving}
        onConfirm={confirmAndSave}
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
