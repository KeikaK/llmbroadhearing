import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

export async function GET() {
  try {
    const dir = path.join(process.cwd(), "data", "questions");
    const names = await fs.readdir(dir);
    const out = [];
    for (const name of names) {
      if (!name.toLowerCase().endsWith(".json")) continue;
      try {
        const txt = await fs.readFile(path.join(dir, name), "utf8");
        const json = JSON.parse(txt);
        out.push({ id: name.replace(/\.json$/i, ""), title: json.title ?? null, description: json.description ?? null, raw: json });
      } catch (e) {
        console.warn("skip question file", name, e);
      }
    }
    out.sort((a, b) => String(a.id).localeCompare(String(b.id)));
    return NextResponse.json(out);
  } catch (e: any) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}