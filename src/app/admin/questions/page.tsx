"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./page.module.css";

/* 管理画面用の型 */
type Q = { id: string; title?: string | null; description?: string | null; raw?: any };

/**
 * QuestionsAdmin
 * - data/questions 配下のテンプレートを一覧表示／編集／作成／削除する管理画面コンポーネント
 * - クライアントサイドで API を呼び出す（/api/questions）
 */
export default function QuestionsAdmin() {
  const router = useRouter();

  // モーダル／トースト制御などの UI state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  const [saveMessage, setSaveMessage] = useState("保存しました");
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);

  // テンプレート一覧と選択、読み込み中フラグ
  const [list, setList] = useState<Q[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // 新規ファイル名入力
  const [newId, setNewId] = useState("");

  // --- UI 用インラインテーマ（明るめの赤テーマ） ---
  const theme = {
    background: "#fff5f5",
    panel: "#ffffff",
    subtle: "#fff1f2",
    accent: "#ef4444",
    accentDark: "#b91c1c",
    text: "#2b0f0f",
    muted: "#7f1d1d",
    inputBorder: "rgba(139, 24, 24, 0.08)",
  };
  // コンテナ等のインラインスタイル（視覚的補助、機能には影響しない）
  const containerStyle: React.CSSProperties = { padding: 24, background: theme.background, minHeight: "100vh", position: "relative" };
  const panelStyle: React.CSSProperties = { background: theme.panel, padding: 18, borderRadius: 12, boxShadow: "0 10px 30px rgba(139,24,24,0.06)" };
  const inputStyle: React.CSSProperties = { width: "100%", padding: "10px 12px", borderRadius: 10, border: `1px solid ${theme.inputBorder}`, background: "#fff", color: theme.text };
  const textareaStyle: React.CSSProperties = { width: "100%", minHeight: 80, fontFamily: "monospace", padding: 12, borderRadius: 10, border: `1px solid ${theme.inputBorder}`, background: "#fff", color: theme.text };
  const buttonPrimary: React.CSSProperties = { background: `linear-gradient(180deg, ${theme.accent}, ${theme.accentDark})`, color: "#fff", padding: "10px 14px", borderRadius: 10, border: "none", cursor: "pointer", fontWeight: 800, boxShadow: "0 8px 20px rgba(239,68,68,0.12)" };
  const buttonSecondary: React.CSSProperties = { background: theme.subtle, color: theme.text, padding: "8px 12px", borderRadius: 10, border: `1px solid ${theme.inputBorder}`, cursor: "pointer", fontWeight: 700 };
  // ラベルスタイル（視認性向上）
  const labelStyle: React.CSSProperties = { display: "block", fontWeight: 800, color: theme.text, fontSize: 14, marginBottom: 6 };
  // --- end styles ---

  // フォームフィールドの state（編集対象）
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [prompt, setPrompt] = useState("");
  const [firstMessage, setFirstMessage] = useState("");
  const [aiModel, setAiModel] = useState("");
  const [extraRaw, setExtraRaw] = useState<any>(null);

  // 追加フィールド: case_id, question_id（テンプレ内部の識別子）
  const [caseId, setCaseId] = useState("");
  const [questionIdField, setQuestionIdField] = useState("");

  // JSON プレビューとパースエラー表示用
  const [previewJson, setPreviewJson] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // マウント時に /api/questions から一覧を取得
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/questions");
        if (!res.ok) throw new Error(await res.text());
        const arr = await res.json();
        // API の raw を保持して選択時に詳細を表示する
        setList(arr.map((d: any) => ({ id: String(d.id), title: d.title ?? d.id, raw: d.raw ?? d })));
      } catch (e) {
        console.warn("load questions failed", e);
      }
    })();
  }, []);

  // selected が変わったら該当テンプレの詳細を読み込む
  useEffect(() => {
    if (!selected) {
      clearForm();
      return;
    }
    setLoading(true);
    (async () => {
      try {
        const res = await fetch(`/api/questions/${encodeURIComponent(selected)}`);
        if (!res.ok) throw new Error(await res.text());
        const j = await res.json();
        // フォームに読み込む（複数キー名に対応）
        setTitle(String(j.title ?? j.name ?? ""));
        setDescription(String(j.description ?? j.desc ?? j.promptDescription ?? ""));
        setPrompt(String(j.prompt ?? j.system_prompt ?? ""));
        setFirstMessage(String(j.first_message ?? j.firstMessage ?? ""));
        setAiModel(String(j.ai_model ?? j.model ?? ""));
        setCaseId(String(j.case_id ?? j.caseId ?? ""));
        setQuestionIdField(String(j.question_id ?? j.questionId ?? ""));
        // raw のうち上で使ったキーを除いた残りを extraRaw として保持
        const copy = { ...j };
        delete copy.title;
        delete copy.description;
        delete copy.prompt;
        delete copy.first_message;
        delete copy.ai_model;
        delete copy.case_id;
        delete copy.caseId;
        delete copy.question_id;
        delete copy.questionId;
        setExtraRaw(Object.keys(copy).length ? copy : null);
        setErrorMsg(null);
      } catch (e: any) {
        console.warn("load question failed", e);
        setErrorMsg(String(e));
        clearForm();
      } finally {
        setLoading(false);
      }
    })();
  }, [selected]);

  // フォームが変わるたびに JSON プレビューを生成（保存時に送る内容）
  useEffect(() => {
    try {
      const out: any = {};
      if (title) out.title = title;
      if (description) out.description = description;
      if (prompt) out.prompt = prompt;
      if (firstMessage) out.first_message = firstMessage;
      if (aiModel) out.ai_model = aiModel;
      if (caseId) out.case_id = caseId;
      if (questionIdField) out.question_id = questionIdField;
      if (extraRaw) Object.assign(out, extraRaw);
      setPreviewJson(JSON.stringify(out, null, 2));
      setErrorMsg(null);
    } catch (e: any) {
      setPreviewJson("");
      setErrorMsg(String(e));
    }
  }, [title, description, prompt, firstMessage, aiModel, extraRaw, caseId, questionIdField]);

  // フォームクリア
  function clearForm() {
    setTitle("");
    setDescription("");
    setPrompt("");
    setFirstMessage("");
    setAiModel("");
    setExtraRaw(null);
    setPreviewJson("");
    setErrorMsg(null);
    setCaseId("");
    setQuestionIdField("");
  }

  // 保存確認モーダル表示（選択がない場合はエラー表示に変更）
  function openSaveConfirm() {
    if (!selected) {
      setErrorMsg("テンプレートを選択してください");
      return;
    }
    setShowSaveConfirm(true);
  }

  // 実際に PUT で保存する処理
  async function performSave() {
    setShowSaveConfirm(false);
    setLoading(true);
    try {
      const body = previewJson ? JSON.parse(previewJson) : {};
      const res = await fetch(`/api/questions/${encodeURIComponent(selected!)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      setSaveMessage("保存しました");
      setShowSaveSuccess(true);
    } catch (e: any) {
      // ブラウザ alert を使わず画面内にエラーメッセージを表示
      setErrorMsg("保存エラー: " + String(e));
    } finally {
      setLoading(false);
    }
  }

  // 削除確認を開く（選択チェック） — alert を errorMsg に置き換え
  function openDeleteConfirm() {
    if (!selected) {
      setErrorMsg("テンプレートを選択してください");
      return;
    }
    setShowDeleteConfirm(true);
  }

  // 削除確定処理（DELETE） — 成功はモーダルで通知、失敗は errorMsg
  async function handleConfirmDelete() {
    setShowDeleteConfirm(false);
    if (!selected) return;
    try {
      const res = await fetch(`/api/questions/${encodeURIComponent(selected)}`, { method: "DELETE" });
      if (!res.ok) {
        setErrorMsg("削除失敗");
        return;
      }
      // ブラウザ alert の代わりに既存の保存モーダルを流用して通知
      setSaveMessage("削除しました");
      setShowSaveSuccess(true);
    } catch (e: any) {
      setErrorMsg("削除エラー: " + String(e));
    }
  }

  // 保存成功モーダルを閉じると一覧をリロード
  function handleSaveClose() {
    setShowSaveSuccess(false);
    location.reload();
  }

  /* ---------- JSX: 管理画面 UI ---------- */
  return (
    <div className={styles.container}>
      {/* ヘッダ */}
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <h1 className={styles.titleGradient}>テンプレート管理</h1>
          <p className={styles.subtitle}>data/questions にあるテンプレートを一覧・編集・作成できます。保存すると JSON ファイルが上書きされます。</p>
        </div>
        <button className={styles.topButton} onClick={() => router.push("/")} aria-label="トップページに戻る">トップページに戻る</button>
      </header>

      <div className={styles.content}>
        <aside className={styles.sidebar}>
          <div className={styles.panel}>
            <input
              placeholder="新規ファイル名"
              value={newId}
              onChange={(e) => {
                // 入力制限: 英数字と . _ - のみ許可し、不正なドット連続や先頭末尾のドットを排除
                let v = e.target.value.replace(/[^a-zA-Z0-9._-]/g, "");
                v = v.replace(/\.{2,}/g, ".");
                v = v.replace(/^\.+/, "").replace(/\.+$/, "");
                setNewId(v);
              }}
              className={styles.input}
              pattern="^[a-zA-Z0-9_-]+(\.[a-zA-Z0-9_-]+)*$"
              title="英数字と . _ - のみ"
              aria-label="新規ファイル名"
            />
            <button onClick={() => { if (newId) setSelected(newId); }} className={styles.primaryFull} disabled={!newId}>新規編集を開始</button>
            <div className={styles.hint}>英数字と . _ - を許可（先頭/末尾にドット不可）</div>
          </div>

          <div className={styles.list}>
            {/* リストヘッダ */}
            <div className={styles.listHeader}>テンプレート一覧</div>

            <div className={styles.list}>
              {list.map((q) => (
                <button
                  key={q.id}
                  onClick={() => setSelected(q.id)}
                  className={`${styles.listItem} ${selected === q.id ? styles.listItemActive : ""}`}
                >
                  <div className={styles.listTitle}>{q.title ?? q.id}</div>
                  <div className={styles.listDesc}>{String(q.raw?.description ?? "")}</div>
                </button>
              ))}
            </div>
          </div>
        </aside>

        <main className={styles.editorWrap}>
          <div className={styles.formColumn}>
            <div className={styles.field}>
              <label className={styles.label}>ID（ファイル名）</label>
              <div className={styles.readOnly}>{selected ?? "(未選択 or 新規)"}</div>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>タイトル(title)</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} className={styles.input} />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>案件ID（case_id）</label>
              <input value={caseId} onChange={(e) => setCaseId(e.target.value)} className={styles.input} />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>質問ID（question_id）</label>
              <input value={questionIdField} onChange={(e) => setQuestionIdField(e.target.value)} className={styles.input} />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>説明 (description)</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} className={styles.textarea} />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>プロンプト(prompt)</label>
              <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} className={styles.textareaLarge} />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>最初のメッセージ(first_message)</label>
              <textarea value={firstMessage} onChange={(e) => setFirstMessage(e.target.value)} className={styles.textarea} />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>AIモデル(ai_model)</label>
              <input value={aiModel} onChange={(e) => setAiModel(e.target.value)} className={styles.input} />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>その他の JSON（オブジェクト）</label>
              <textarea
                value={extraRaw ? JSON.stringify(extraRaw, null, 2) : ""}
                onChange={(e) => {
                  // ユーザ入力を JSON としてパースし、失敗時はエラー表示
                  try {
                    const v = e.target.value.trim() ? JSON.parse(e.target.value) : null;
                    setExtraRaw(v);
                    setErrorMsg(null);
                  } catch (err: any) {
                    setErrorMsg("その他 JSON のパースエラー");
                  }
                }}
                className={styles.textareaLarge}
              />
            </div>

            <div className={styles.actions}>
              <button onClick={openSaveConfirm} disabled={!selected || loading} className={styles.primary}>保存</button>
              <button onClick={openDeleteConfirm} disabled={!selected} className={styles.secondary}>削除</button>
              <button onClick={clearForm} className={styles.secondary}>クリア</button>
            </div>

            {errorMsg && <div className={styles.error}>{errorMsg}</div>}
          </div>

          <aside className={styles.previewWrap}>
            <div className={styles.previewTitle}>JSON プレビュー</div>
            <textarea readOnly value={previewJson} className={styles.previewArea} />
            <div className={styles.hint}>編集フィールドは自動で JSON にマージされます。特殊キーは「その他の JSON」へ。</div>
          </aside>
        </main>
      </div>

      {/* 削除確認モーダル */}
      {showDeleteConfirm && (
        <div className={styles.confirmOverlay} role="dialog" aria-modal="true" aria-label="削除確認ダイアログ">
          <div className={styles.confirmDialog}>
            <div className={styles.confirmTitle}>テンプレートを削除します</div>
            <div className={styles.confirmMessage}>
              選択中: <strong>{selected}</strong><br />
              本当に削除しますか？この操作は取り消せません。
            </div>
            <div className={styles.confirmActions}>
              <button className={styles.confirmSecondary} onClick={() => setShowDeleteConfirm(false)}>キャンセル</button>
              <button className={styles.confirmPrimary} onClick={handleConfirmDelete}>削除する</button>
            </div>
          </div>
        </div>
      )}

      {/* 保存確認モーダル */}
      {showSaveConfirm && (
        <div className={styles.confirmOverlay} role="dialog" aria-modal="true" aria-label="保存確認ダイアログ">
          <div className={styles.confirmDialog}>
            <div className={styles.confirmTitle}>テンプレートを保存します</div>
            <div className={styles.confirmMessage}>
              選択中: <strong>{selected}</strong><br />
              編集内容を保存しますか？
            </div>
            <div className={styles.confirmActions}>
              <button className={styles.confirmSecondary} onClick={() => setShowSaveConfirm(false)}>キャンセル</button>
              <button className={styles.confirmPrimary} onClick={performSave}>保存する</button>
            </div>
          </div>
        </div>
      )}

      {/* 保存成功モーダル */}
      {showSaveSuccess && (
        <div className={styles.confirmOverlay} role="dialog" aria-modal="true" aria-label="保存完了ダイアログ">
          <div className={styles.confirmDialog}>
            <div className={styles.confirmTitle}>保存しました</div>
            <div className={styles.confirmMessage}>
              {saveMessage}
            </div>
            <div className={styles.confirmActions}>
              <button className={styles.confirmPrimary} onClick={handleSaveClose}>OK</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}