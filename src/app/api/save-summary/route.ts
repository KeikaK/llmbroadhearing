import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { ChatOpenAI } from "@langchain/openai";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const fileName = body?.file;
    const messages = Array.isArray(body?.messages) ? body.messages : [];
    const question = body?.question ?? null;

    if (!fileName) {
      return NextResponse.json({ ok: false, message: "missing file" }, { status: 400 });
    }

    // 会話をテキスト化（長すぎる場合は切り詰め）
    const conv = messages
      .map((m: any) => `${m.role === "user" ? "ユーザー" : m.role === "assistant" ? "AI" : "システム"}: ${m.content}`)
      .join("\n")
      .slice(0, 4000);

    // ユーザー視点を優先して、ユーザーが何を感じ・望み・次に何をしたいか（具体的な一歩）を強調するプロンプト
    let humanText = `以下の会話ログを「ユーザー視点」で要約してください。特に「ユーザーが何を感じ、何を望み、どのような行動（次の具体的な一歩）を取りたいか」を強調し、日本語で約100文字にまとめてください。\n\n会話ログ:\n${conv}\n`;
    if (question) {
      humanText += `\nテンプレート情報:\nタイトル: ${question.title ?? ""}\n説明: ${question.description ?? ""}\n`;
    }
    humanText += `\n出力は日本語で100文字前後の要約のみを返してください。余計な注釈や補足は不要です。`;

    // すばやく終わるモデルを選ぶか環境変数から取得
    const llm = new ChatOpenAI({
      model: process.env.LLM_MODEL ?? "gpt-5-nano",
      apiKey: process.env.OPENAI_API_KEY,
      streaming: false,
    });

    const result: any = await llm.invoke([new SystemMessage("あなたは要約の専門家です。"), new HumanMessage(humanText)]);

    // 戻り値からテキストを取り出す（安全化）
    let summary: string;
    if (typeof result === "string") {
      summary = result.trim();
    } else if (result == null) {
      summary = "";
    } else if (typeof (result as any).content === "string") {
      summary = (result as any).content.trim();
    } else if (typeof (result as any).text === "string") {
      summary = (result as any).text.trim();
    } else if (Array.isArray(result) && result[0] && typeof (result[0] as any).content === "string") {
      summary = (result[0] as any).content.trim();
    } else {
      summary = String(result).trim();
    }

    // デバッグログ：生成された要約を出力（ファイルへ書き込む前に確認）
    try {
      console.log("[api/save-summary] generated summary:", summary);
      // 必要なら要約の先頭数文字だけ出す場合:
      // console.log("[api/save-summary] summary preview:", summary.slice(0, 200));
    } catch (e) {
      console.warn("[api/save-summary] failed to log summary:", String(e));
    }

    // 保存ファイルを読み出して summary を注入して上書き
    const filePath = path.join(process.cwd(), "data", "sessions", String(fileName));
    try {
      const txt = await fs.readFile(filePath, "utf8");
      const json = JSON.parse(txt);
      json.summary = summary;
      await fs.writeFile(filePath, JSON.stringify(json, null, 2), "utf8");
      console.log("[api/save-summary] updated file with summary:", filePath, "summary length:", summary.length);
      return NextResponse.json({ ok: true });
    } catch (e: any) {
      console.error("[api/save-summary] failed to update file:", e);
      return NextResponse.json({ ok: false, message: String(e) }, { status: 500 });
    }
  } catch (e: any) {
    console.error("[api/save-summary] error:", e);
    return NextResponse.json({ ok: false, message: e?.message ?? String(e) }, { status: 500 });
  }
}