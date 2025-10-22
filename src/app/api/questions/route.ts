import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

/**
 * GET /api/questions
 * data/questions フォルダ内の JSON ファイルを走査して一覧メタを返すエンドポイント。
 * - id: ファイル名（拡張子なし）
 * - title: json.title（無ければ null）
 * - description: json.description（無ければ null）
 * - raw: パースした JSON 全体
 *
 * 注意:
 * - サーバーサイド（Node.js）の fs を使用しています。Edge ランタイムでは動作しません。
 * - 個別ファイルの読み込み/パースに失敗した場合はログ出力して該当ファイルをスキップします。
 * - 大量ファイルや外部からの改変がある場合は追加のバリデーションを検討してください。
 */
export async function GET() {
  try {
    // questions ディレクトリのパスを組み立て
    const dir = path.join(process.cwd(), "data", "questions");

    // ディレクトリ内のファイル名一覧を取得
    const names = await fs.readdir(dir);
    const out: Array<any> = [];

    // 各ファイルを順に処理する
    for (const name of names) {
      // JSON ファイル以外は無視
      if (!name.toLowerCase().endsWith(".json")) continue;
      try {
        // ファイルを読み込み JSON パース
        const txt = await fs.readFile(path.join(dir, name), "utf8");
        const json = JSON.parse(txt);

        // レスポンス用に必要なメタだけを抽出して push
        out.push({
          id: name.replace(/\.json$/i, ""),
          title: json.title ?? null,
          description: json.description ?? null,
          raw: json,
        });
      } catch (e) {
        // 個別ファイルの読み取り/パース失敗はスキップして警告出力
        console.warn("skip question file", name, e);
      }
    }

    // 安定した順序で返すためソート（必要であれば別のキーに変更）
    out.sort((a, b) => String(a.id).localeCompare(String(b.id)));

    // 成功時は配列を JSON で返却
    return NextResponse.json(out);
  } catch (e: any) {
    // ディレクトリ読み取りなどで致命的なエラーが発生した場合は 500 を返す
    console.error("/api/questions error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}