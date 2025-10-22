import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

/**
 * safeId
 * - リクエストから受け取った id をファイル名として安全に扱える形に正規化する。
 * - 英数字と `_` `-` のみ許可し、その他の文字を `_` に置換することでパス侵入や不正な文字を防ぐ。
 */
function safeId(id: any) {
  return String(id ?? "").replace(/[^a-zA-Z0-9_\-]/g, "_");
}

/**
 * idFromRequest
 * - NextRequest の URL から動的セグメント (最後のパス要素) を抽出してデコードして返す。
 * - 例: /api/questions/foo -> "foo"
 * - 失敗時は空文字を返す（呼び出し側でチェック）
 */
function idFromRequest(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const parts = url.pathname.split("/").filter(Boolean);
    // 最後のセグメントを id と見なす
    const raw = parts[parts.length - 1] ?? "";
    return decodeURIComponent(raw);
  } catch {
    return "";
  }
}

/**
 * GET /api/questions/[id]
 * - 指定 id の question JSON を返す
 * - id は safeId で正規化して data/questions/<id>.json を読み込む
 * - 見つからない / パースエラーは 404 を返却
 */
export async function GET(req: NextRequest) {
  try {
    const rawId = idFromRequest(req);
    const id = safeId(rawId);
    const filePath = path.join(process.cwd(), "data", "questions", `${id}.json`);
    const txt = await fs.readFile(filePath, "utf8");
    return NextResponse.json(JSON.parse(txt));
  } catch (e: any) {
    // ファイルが存在しない／読み取りエラーの場合は 404 相当で返す
    return NextResponse.json({ error: String(e) }, { status: 404 });
  }
}

/**
 * PUT /api/questions/[id]
 * - リクエストボディ(JSON) を指定 id のファイルとして保存する（上書き）
 * - body のバリデーションは最小限。必要なら追加検証を入れてください。
 */
export async function PUT(req: NextRequest) {
  try {
    const rawId = idFromRequest(req);
    const id = safeId(rawId);
    const body = await req.json();
    const filePath = path.join(process.cwd(), "data", "questions", `${id}.json`);
    await fs.writeFile(filePath, JSON.stringify(body, null, 2), "utf8");
    return NextResponse.json({ ok: true, file: `${id}.json` });
  } catch (e: any) {
    // 書き込み失敗などは 500
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

/**
 * DELETE /api/questions/[id]
 * - 指定 id のファイルを削除する
 * - 存在しない場合や削除失敗時は 500 を返す（必要に応じて 404 処理に変更可）
 */
export async function DELETE(req: NextRequest) {
  try {
    const rawId = idFromRequest(req);
    const id = safeId(rawId);
    const filePath = path.join(process.cwd(), "data", "questions", `${id}.json`);
    await fs.unlink(filePath);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}