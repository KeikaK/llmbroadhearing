import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

function safeId(id: any) {
  return String(id ?? "").replace(/[^a-zA-Z0-9_\-]/g, "_");
}

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

export async function GET(req: NextRequest) {
  try {
    const rawId = idFromRequest(req);
    const id = safeId(rawId);
    const filePath = path.join(process.cwd(), "data", "questions", `${id}.json`);
    const txt = await fs.readFile(filePath, "utf8");
    return NextResponse.json(JSON.parse(txt));
  } catch (e: any) {
    return NextResponse.json({ error: String(e) }, { status: 404 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const rawId = idFromRequest(req);
    const id = safeId(rawId);
    const body = await req.json();
    const filePath = path.join(process.cwd(), "data", "questions", `${id}.json`);
    await fs.writeFile(filePath, JSON.stringify(body, null, 2), "utf8");
    return NextResponse.json({ ok: true, file: `${id}.json` });
  } catch (e: any) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

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