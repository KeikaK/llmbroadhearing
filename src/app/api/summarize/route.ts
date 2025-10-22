import { NextRequest, NextResponse } from "next/server";
import { ChatOpenAI } from "@langchain/openai";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";

/**
 * POST /api/summarize
 * リクエストボディ:
 *   { messages: Array, question?: any }
 * 会話ログを受け取り、LangChain 経由で要約を取得して返すエンドポイント。
 *
 * 注意:
 * - 外部 API 呼び出しを行うため、環境変数 OPENAI_API_KEY と LLM_MODEL を設定してください。
 * - 入力の文章長が長すぎる場合は切り詰め（ここでは先頭 10000 文字）して送信します。
 * - LangChain の返り値は型が安定しないため、文字列抽出に複数のパターンを試しています。
 */
export async function POST(req: NextRequest) {
  try {
    // リクエストボディから messages と question を取り出す（存在しない場合は空配列）
    const body = await req.json();
    const messages = Array.isArray(body?.messages) ? body.messages : [];
    const question = body?.question ?? null;

    // 会話をテキスト化して要約用のプロンプトを作成
    // m.role に基づいてユーザー/AI/システムのプレフィックスを付与
    const conv = messages
      .map((m: any) => `${m.role === "user" ? "ユーザー" : m.role === "assistant" ? "AI" : "システム"}: ${m.content}`)
      // 長すぎる場合は切り詰め（API トークンコスト回避）
      .join("\n")
      .slice(0, 10000);

    // 要約プロンプト（日本語で約50文字を指示）
    let humanText = `以下の会話ログを重要点がわかるように日本語で約50文字に要約してください。\n\n会話ログ:\n${conv}\n`;
    humanText += `\n出力は日本語で50文字前後の要約のみを返してください。余計な注釈は不要です。`;

    // LangChain ChatOpenAI の初期化
    const llm = new ChatOpenAI({
      model: process.env.LLM_MODEL ?? "gpt-5-nano",
      apiKey: process.env.OPENAI_API_KEY,
      streaming: false,
    });

    // LLM 呼び出し。SystemMessage でロールを指定、HumanMessage にプロンプトを入れる
    const result: any = await llm.invoke([new SystemMessage("あなたは要約の専門家です。"), new HumanMessage(humanText)]);

    // LangChain の戻り値は string / AIMessage / 配列 等、形がまちまちなので安全に取り出す
    let summary: string;
    if (typeof result === "string") {
      summary = result.trim();
    } else if (result == null) {
      summary = "";
    } else if (typeof (result as any).content === "string") {
      // AIMessage の場合など content プロパティを優先
      summary = (result as any).content.trim();
    } else if (typeof (result as any).text === "string") {
      summary = (result as any).text.trim();
    } else if (Array.isArray(result) && result[0] && typeof (result[0] as any).content === "string") {
      // 配列で返ってきた場合の安全対策
      summary = (result[0] as any).content.trim();
    } else {
      // 最後の手段で安全に文字列化
      summary = String(result).trim();
    }

    // 成功時は要約文字列を返す
    return NextResponse.json({ summary });
  } catch (e: any) {
    // エラーハンドリング: ログを出して 500 で返却
    console.error("[api/summarize] error:", e);
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}