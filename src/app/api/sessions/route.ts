import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

export async function GET() {
  try {
    const dir = path.join(process.cwd(), "data", "sessions");
    const names = await fs.readdir(dir);
    const out: Array<any> = [];

    for (const name of names) {
      if (!name.toLowerCase().endsWith(".json")) continue;
      try {
        const txt = await fs.readFile(path.join(dir, name), "utf8");
        const json = JSON.parse(txt);
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
        console.warn("[api/sessions] skip file:", name, e);
      }
    }

    // 新しい順にソート（存在しなければファイル名順）
    out.sort((a, b) => {
      const ta = a.exportedAt ? Date.parse(a.exportedAt) : 0;
      const tb = b.exportedAt ? Date.parse(b.exportedAt) : 0;
      return tb - ta || String(b.file).localeCompare(String(a.file));
    });

    return NextResponse.json(out);
  } catch (e: any) {
    console.error("[api/sessions] error:", e);
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}