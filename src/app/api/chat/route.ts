import { NextRequest, NextResponse } from "next/server";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const messages: Array<{ role: string; content: string }> = body?.messages ?? [];

    // フロントから来た会話履歴を LangChain の Message へ変換
    const lcMessages = messages.map((m) => {
      if (m.role === "system") return new SystemMessage(m.content);
      if (m.role === "assistant") return new AIMessage(m.content);
      return new HumanMessage(m.content); // default: user
    });

    // ストリーミング用のストリームを作成（クライアントへ逐次送る）
    const encoder = new TextEncoder();
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();

    // 1文字ずつ送るために token を分解して書き出す（必要なら遅延を入れる）
    const perCharDelayMs = 50; // 1〜10 にするとより逐次表示っぽくなる

    const llm = new ChatOpenAI({
      model: process.env.LLM_MODEL ?? "gpt-5-nano", // 安定動作するモデルをデフォルトに
      apiKey: process.env.OPENAI_API_KEY,
      streaming: true,
      callbacks: [
        {
          // LangChain のコールバックで新トークンを受け取り、1文字ずつ送る
          handleLLMNewToken: async (token: string) => {
            for (const ch of token) {
              try {
                await writer.ready;
                await writer.write(encoder.encode(ch));
                if (perCharDelayMs > 0) await new Promise((r) => setTimeout(r, perCharDelayMs));
              } catch (e) {
                console.error("writer.write failed:", e);
              }
            }
          },
          handleLLMEnd: async () => {
            try {
              await writer.close();
            } catch (e) {
              console.error("writer.close failed:", e);
            }
          },
        },
      ],
    });

    // 非同期で invoke を実行。エラー時はストリームにエラーメッセージを書いて閉じる
    llm
      .invoke(
        lcMessages.length
          ? lcMessages
          : [
              new SystemMessage("あなたは詩人です"),
              new HumanMessage("50字程度の詩をかいてください"),
            ]
      )
      .catch(async (err: any) => {
        const msg = `[ERROR] ${err?.message ?? String(err)}`;
        try {
          await writer.ready;
          await writer.write(encoder.encode(msg));
        } finally {
          try {
            await writer.close();
          } catch {}
        }
        console.error("LLM invoke failed:", err);
      });

    return new NextResponse(readable, {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}