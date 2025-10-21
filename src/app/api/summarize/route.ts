import { NextRequest, NextResponse } from "next/server";
import { ChatOpenAI } from "@langchain/openai";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const messages = Array.isArray(body?.messages) ? body.messages : [];
    const question = body?.question ?? null;

    // 会話をテキスト化（長すぎる場合は切り詰め）
    const conv = messages
      .map((m: any) => `${m.role === "user" ? "ユーザー" : m.role === "assistant" ? "AI" : "システム"}: ${m.content}`)
      .join("\n")
      .slice(0, 4000);

    let humanText = `以下の会話ログを重要点がわかるように日本語で約50文字に要約してください。\n\n会話ログ:\n${conv}\n`;

    humanText += `\n出力は日本語で50文字前後の要約のみを返してください。余計な注釈は不要です。`;

    const llm = new ChatOpenAI({
      model: process.env.LLM_MODEL ?? "gpt-5-nano",
      apiKey: process.env.OPENAI_API_KEY,
      streaming: false,
    });

    const result: any = await llm.invoke([new SystemMessage("あなたは要約の専門家です。"), new HumanMessage(humanText)]);
    // LangChain の戻り値は string 以外（AIMessage 等）の場合があるため、content/text を優先して取り出す
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
      // 最後の手段で安全に文字列化
      summary = String(result).trim();
    }

    return NextResponse.json({ summary });
  } catch (e: any) {
    console.error("[api/summarize] error:", e);
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}