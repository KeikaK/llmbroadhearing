// API: POST /api/save
// このエンドポイントは受け取ったセッションデータをプロジェクト内の
// data/sessions ディレクトリに JSON ファイルとして保存します。
// 注意点:
// - Edge ランタイムではファイル書き込みできないため Node.js ランタイムを指定
// - クライアント入力は検証し最小限の前提に基づいて処理すること（ここでは messages の配列を必須とする)

import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

// 重要: Edge ではファイル書き込み不可。Node.js ランタイムを明示して Node の fs を使う
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    // リクエストボディを JSON として取得
    const body = await req.json();

    // 期待するペイロードの簡易バリデーション
    // 必須: messages は配列であること
    if (!body || !Array.isArray(body.messages)) {
      // クライアント側の送信ミスや不正なリクエストには 400 を返す
      return NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 });
    }

    // 保存先ディレクトリ: プロジェクト配下 data/sessions/
    const rootDir = path.join(process.cwd(), "data", "sessions");
    // 存在しなければ作成（recursive）
    await fs.mkdir(rootDir, { recursive: true });

    // ファイル名をタイムスタンプベースで生成
    // 例: hearing_20251022_153045.json
    const d = new Date();
    const pad = (n: number) => n.toString().padStart(2, "0");
    const fname = `hearing_${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(
      d.getHours()
    )}${pad(d.getMinutes())}${pad(d.getSeconds())}.json`;

    // フルパスを組み立てて書き込み
    const fullPath = path.join(rootDir, fname);
    // JSON.stringify の第二引数は整形用（読みやすさ重視）
    await fs.writeFile(fullPath, JSON.stringify(body, null, 2), "utf8");

    // 成功応答: 保存したファイル名を返す
    return NextResponse.json({ ok: true, file: fname });
  } catch (e: any) {
    // サーバー側の致命的なエラーはログ出力して 500 を返す
    console.error("SAVE_ERROR:", e);
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
