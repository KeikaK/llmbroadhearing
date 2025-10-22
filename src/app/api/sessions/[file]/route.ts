import { NextResponse } from "next/server";
import { readSessionFile, ensureJsonFilename } from "../../../../lib/session";

/**
 * GET /api/sessions/[file]
 * 動的ルートの handler。params は Promise の可能性があるため await して使用すること。
 * - file が指定されていなければ 400 を返す
 * - ファイル名を正規化して読み込み、JSON を返す
 * - ファイルが見つからない／読み込みエラーの場合は 404 を返す
 * - その他の例外は 500 を返す
 */
export async function GET(_: Request, { params }: { params: any }) {
  try {
    // Next.js の params は同期値または Promise の場合があるため await して取得
    const { file } = await params;
    if (!file) return new NextResponse("Missing filename", { status: 400 });

    // ファイル名を .json 付きに正規化（パス侵入対策はライブラリ側で行う）
    const safe = ensureJsonFilename(String(file));

    try {
      // 読み込みは共通ユーティリティに委譲
      const json = await readSessionFile(safe);
      return NextResponse.json(json);
    } catch (e: any) {
      // ファイルが存在しない、またはパースに失敗した場合は 404 を返す（詳細はログで確認）
      return new NextResponse(String(e?.message ?? "Not found"), { status: 404 });
    }
  } catch (err: any) {
    // 想定外のエラーは 500
    return new NextResponse(String(err?.message ?? "internal error"), { status: 500 });
  }
}