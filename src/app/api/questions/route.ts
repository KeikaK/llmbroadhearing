import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

export async function GET() {
  try {
    const dir = path.join(process.cwd(), "data", "questions");
    const names = await fs.readdir(dir);
    const items: Array<{ id: string; title: string; raw?: any }> = [];

    for (const name of names) {
      if (!name.toLowerCase().endsWith(".json")) continue;
      try {
        const txt = await fs.readFile(path.join(dir, name), "utf8");
        const json = JSON.parse(txt);
        items.push({ id: path.parse(name).name, title: String(json.title ?? json.name ?? json.title ?? "untitled"), raw: json });
      } catch (e) {
        // 個別ファイルの読み取り/パース失敗はログに出してスキップ
        console.error("read question file failed:", name, e);
      }
    }

    return NextResponse.json(items);
  } catch (e: any) {
    console.error("questions API failed:", e);
    return NextResponse.json({ error: e?.message ?? "failed" }, { status: 500 });
  }
}