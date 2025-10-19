import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

// 重要: Edge ではファイル書き込み不可。Node.js ランタイムを明示
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // 期待するペイロード例:
    // { app: string, version: number, exportedAt: string, timeZone: string, messages: any[], meta?: any }
    if (!body || !Array.isArray(body.messages)) {
      return NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 });
    }

    // 保存先ディレクトリ: プロジェクト配下 data/sessions/
    const rootDir = path.join(process.cwd(), "data", "sessions");
    await fs.mkdir(rootDir, { recursive: true });

    // ファイル名: hearing_YYYYMMDD_HHMMSS.json
    const d = new Date();
    const pad = (n: number) => n.toString().padStart(2, "0");
    const fname = `hearing_${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(
      d.getHours()
    )}${pad(d.getMinutes())}${pad(d.getSeconds())}.json`;

    const fullPath = path.join(rootDir, fname);
    await fs.writeFile(fullPath, JSON.stringify(body, null, 2), "utf8");

    return NextResponse.json({ ok: true, file: fname });
  } catch (e: any) {
    console.error("SAVE_ERROR:", e);
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
