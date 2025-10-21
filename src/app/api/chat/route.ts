import { NextRequest, NextResponse } from "next/server";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import fs from "fs/promises";
import path from "path";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    // 受信内容をデバッグ出力（ターミナルで確認）
    try {
      console.log("[api/chat] POST body:", body);
    } catch (e) {
      console.log("[api/chat] POST body: <unserializable>");
    }
    const messages: Array<{ role: string; content: string }> = body?.messages ?? [];

    // フロントから来た会話履歴を LangChain の Message へ変換
    const lcMessages = messages.map((m) => {
      if (m.role === "system") return new SystemMessage(m.content);
      if (m.role === "assistant") return new AIMessage(m.content);
      return new HumanMessage(m.content); // default: user
    });

    // 質問ID が渡されていれば data/questions/{id}.json を読み込んでフォールバック用に保持
    let questionJson: any = null;
    const questionId = body?.question ?? body?.questionId ?? null;
    console.log("[api/chat] computed questionId:", questionId);
    if (questionId) {
      try {
        const filePath = path.join(process.cwd(), "data", "questions", `${String(questionId)}.json`);
        const txt = await fs.readFile(filePath, "utf8");
        questionJson = JSON.parse(txt);
        // デバッグログ：JSON が正しく読めているか確認
        console.log("[api/chat] loaded question json", { questionId, filePath, questionJson });
      } catch (e) {
        // 読み込み失敗もログに出す
        console.warn("[api/chat] failed to load question json", { questionId, error: String(e) });
        console.warn("question json load failed:", questionId, e);
      }
    }
    const defaultFallback = [
      new SystemMessage("あなたは詩人です"),
      new HumanMessage("50字程度の詩をかいてください"),
    ];
    const jsonFallback =
      questionJson && (questionJson.prompt || questionJson.first_message)
        ? [
            ...(questionJson.prompt ? [new SystemMessage(String(questionJson.prompt))] : []),
            ...(questionJson.first_message ? [new HumanMessage(String(questionJson.first_message))] : []),
          ]
        : null;

    // ストリーミング用のストリームを作成（クライアントへ逐次送る）
    const encoder = new TextEncoder();
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();

    // 1文字ずつ送るために token を分解して書き出す（必要なら遅延を入れる）
    const perCharDelayMs = 5; // 1〜10 にするとより逐次表示っぽくなる

    // JSON に ai_model があればそれを優先、なければ環境変数、最終フォールバックを使用
    const selectedModel = (questionJson?.ai_model as string | undefined) ?? process.env.LLM_MODEL ?? "gpt-5-nano";
    console.log("[api/chat] selected LLM model:", selectedModel);

    const llm = new ChatOpenAI({
      model: selectedModel,
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
        // lcMessages があればそれを使、なければ JSON からのフォールバック（あれば）→最後に既定値
        lcMessages.length ? lcMessages : jsonFallback ? jsonFallback : defaultFallback
      )
      .then(() => {
        console.log("[api/chat] llm.invoke resolved");
      })
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