"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./page.module.css";

type Msg = { role: "user" | "assistant"; content: string; at?: string };

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

export default function ChatPage() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<"save" | "discard">("save");
  const [toast, setToast] = useState<{
    open: boolean;
    type: "info" | "success" | "error";
    msg: string;
  }>({ open: false, type: "info", msg: "" });

  const listRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const composerRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  const now = () =>
    new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

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
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: reply, at: now() },
      ]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Error: ${err?.message ?? String(err)}`,
          at: now(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;
    const text = input;
    setInput("");
    await sendImpl(text);
    taRef.current?.focus();
  };

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

  // 汎用の確認ダイアログを開く（action: "save" | "discard"）
  const openConfirm = (action: "save" | "discard" = "save") => {
    setConfirmAction(action);
    setConfirmOpen(true);
  };

  // ConfirmModal の確定時ハンドラ（保存 or 保存せず戻る）
  const handleConfirm = async () => {
    if (confirmAction === "save") {
      // 既存の保存処理を再利用
      await confirmAndSave();
      return;
    }
    // 保存せずに前画面に戻る
    setConfirmOpen(false);
    router.back();
  };

  const confirmAndSave = async () => {
    setSaving(true);
    try {
      const payload = {
        exportedAt: new Date().toISOString(),
        messages,
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
      setTimeout(() => router.push("/"), 900);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <div className={styles.title}>ヒアリング</div>
        <div className={styles.headerActions}>
          {/* 保存せずに終了（保存して終了ボタンの左） */}
          <button
            className={styles.btnGhost}
            onClick={() => openConfirm("discard")}
            aria-label="保存せずに終了"
          >
            保存せずに終了
          </button>

          {/* 既存の「保存してヒアリングを終了」ボタン（例） */}
          <button
            className={styles.endBtn}
            onClick={() => openConfirm("save")}
            aria-label="保存してヒアリングを終了"
          >
            保存してヒアリングを終了
          </button>
        </div>
      </header>

      <div
        ref={listRef}
        className={`${styles.list} ${
          messages.length === 0 ? styles.listEmpty : ""
        }`}
      >
        {messages.length === 0 ? (
          <div className={styles.empty}>メッセージを入力して開始してください。</div>
        ) : (
          messages.map((m, i) => {
            const mine = m.role === "user";
            return (
              <div
                key={i}
                className={`${styles.row} ${mine ? styles.me : styles.ai}`}
              >
                {!mine && (
                  <div className={styles.avatar}>
                    <img className={styles.myIcon} src="/ai.png" alt="AI" />
                  </div>
                )}
                <div
                  className={`${styles.bubble} ${
                    mine ? styles.meBubble : styles.aiBubble
                  }`}
                >
                  <div className={styles.text}>{m.content}</div>
                  <div
                    className={`${styles.meta} ${
                      mine ? styles.meMeta : styles.aiMeta
                    }`}
                  >
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
