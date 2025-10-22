// API: GET /api/sessions
// このルートは data/sessions フォルダ内の JSON セッションファイルを走査し、一覧メタを返します。

import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

export async function GET() {
  try {
    // セッションファイル格納ディレクトリ
    const dir = path.join(process.cwd(), "data", "sessions");

    // ディレクトリを読み、ファイル名一覧を取得
    const names = await fs.readdir(dir);
    const out: Array<any> = [];

    // 各ファイルを順に処理
    for (const name of names) {
      // JSON ファイル以外はスキップ
      if (!name.toLowerCase().endsWith(".json")) continue;
      try {
        // ファイル読み込みと JSON パース
        const txt = await fs.readFile(path.join(dir, name), "utf8");
        const json = JSON.parse(txt);

        // レスポンス用に必要なメタを抽出して配列に push
        out.push({
          file: name,
          exportedAt: json.exportedAt ?? json.exportedAt,
          questionTitle: json?.question?.title ?? null,
          // 追加: セッション内の question_id を返す（テンプレ側 id と突合に使う）
          questionId: json?.question?.question_id ?? json?.question?.questionId ?? json?.question?.id ?? null,
          summary: json?.summary ?? null,
          ai_model: json?.question?.ai_model ?? null,
        });
      } catch (e) {
        // 個別ファイルの読み込み/パース失敗は一覧から除外しつつ警告ログを出す
        console.warn("[api/sessions] skip file:", name, e);
      }
    }

    // 新しい順（exportedAt の降順）。日時が無ければファイル名順にフォールバック
    out.sort((a, b) => {
      const ta = a.exportedAt ? Date.parse(a.exportedAt) : 0;
      const tb = b.exportedAt ? Date.parse(b.exportedAt) : 0;
      return tb - ta || String(b.file).localeCompare(String(a.file));
    });

    // JSON で返却
    return NextResponse.json(out);
  } catch (e: any) {
    // ディレクトリ読み取り等で致命的なエラーが発生した場合は 500 を返す
    console.error("[api/sessions] error:", e);
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}