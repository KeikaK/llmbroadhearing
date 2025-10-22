/**
 * POST /api/chat
 * - クライアントから会話履歴と任意の question id を受け取り、
 *   LangChain (ChatOpenAI) をストリーミングで呼び出して逐次テキストを返すエンドポイント。
 * - ストリームはテキスト/plain で 1 文字ずつ送出（フロント側で連結表示する想定）
 *
 * 注意点（コメントを参照）:
 * - file/path の読み込みはサーバー側 fs を直接利用（Node ランタイムを想定）
 * - 外部入力 (questionId 等) をファイルパスにそのまま使うとパス侵入の危険があるため
 *   実運用ではホワイトリストや safeId 処理を導入してください。
 */
import { NextRequest, NextResponse } from "next/server";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import fs from "fs/promises";
import path from "path";

export async function POST(req: NextRequest) {
  try {
    // リクエスト JSON を取得
    const body = await req.json();

    // デバッグ出力（serializable でない場合はフォールバック）
    try {
      console.log("[api/chat] POST body:", body);
    } catch (e) {
      console.log("[api/chat] POST body: <unserializable>");
    }

    // フロント送信の messages を LangChain に合わせて変換
    const messages: Array<{ role: string; content: string }> = body?.messages ?? [];
    const lcMessages = messages.map((m) => {
      if (m.role === "system") return new SystemMessage(m.content);
      if (m.role === "assistant") return new AIMessage(m.content);
      return new HumanMessage(m.content); // default: user
    });

    // questionId がある場合は data/questions/<id>.json を読み込んでフォールバックプロンプトに使う
    // ※ 要注意: id を検証しないとパス侵入のリスクあり（現状はそのまま使用している）
    let questionJson: any = null;
    const questionId = body?.question ?? body?.questionId ?? null;
    console.log("[api/chat] computed questionId:", questionId);
    if (questionId) {
      try {
        const filePath = path.join(process.cwd(), "data", "questions", `${String(questionId)}.json`);
        const txt = await fs.readFile(filePath, "utf8");
        questionJson = JSON.parse(txt);
        console.log("[api/chat] loaded question json", { questionId, filePath, questionJson });
      } catch (e) {
        // ログは残すが処理は継続（フォールバックとして defaultFallback を使う）
        console.warn("[api/chat] failed to load question json", { questionId, error: String(e) });
      }
    }

    // デフォルトプロンプト（questionJson が無ければこちらを使う）
    const defaultFallback = [
      new SystemMessage("あなたは詩人です"),
      new HumanMessage("50字程度の詩をかいてください"),
    ];

    // questionJson に基づくフォールバックの組み立て（存在すれば SystemMessage / HumanMessage を追加）
    const jsonFallback =
      questionJson && (questionJson.prompt || questionJson.first_message)
        ? [
            ...(questionJson.prompt ? [new SystemMessage(String(questionJson.prompt))] : []),
            ...(questionJson.first_message ? [new HumanMessage(String(questionJson.first_message))] : []),
          ]
        : null;

    // ストリーミングのための TransformStream と writer を用意
    const encoder = new TextEncoder();
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();

    // 逐次送出の演出速度（ms）。非常に小さい値だと高速に流れる
    const perCharDelayMs = 5;

    // モデル選択：questionJson の ai_model を優先、その後環境変数、最後に固定文字列
    const selectedModel = (questionJson?.ai_model as string | undefined) ?? process.env.LLM_MODEL ?? "gpt-5-nano";
    console.log("[api/chat] selected LLM model:", selectedModel);

    // LangChain ChatOpenAI をストリーミングモードで初期化
    const llm = new ChatOpenAI({
      model: selectedModel,
      apiKey: process.env.OPENAI_API_KEY,
      streaming: true,
      callbacks: [
        {
          // 新しいトークン受信時に 1 文字ずつストリームへ書き出す
          handleLLMNewToken: async (token: string) => {
            for (const ch of token) {
              try {
                await writer.ready;
                await writer.write(encoder.encode(ch));
                if (perCharDelayMs > 0) await new Promise((r) => setTimeout(r, perCharDelayMs));
              } catch (e) {
                // write に失敗しても呼び出し側が落ちないようにログに留める
                console.error("writer.write failed:", e);
              }
            }
          },
          // LLM 完了時にストリームを閉じる
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

    // 非同期で invoke を実行。戻り値は Promise（成功/失敗によりストリームの閉じ方を制御）
    llm
      .invoke(
        // lcMessages があればそれを優先、なければ jsonFallback（存在すれば）→ defaultFallback
        lcMessages.length ? lcMessages : jsonFallback ? jsonFallback : defaultFallback
      )
      .then(() => {
        console.log("[api/chat] llm.invoke resolved");
      })
      .catch(async (err: any) => {
        // LLM 呼び出しが失敗した場合はストリームにエラーメッセージを書いて閉じる
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

    // クライアントへは readable を返す（text/plain） — フロントは逐次受信して表示する想定
    return new NextResponse(readable, {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (e: any) {
    // 想定外の例外は 500 を返す
    console.error(e);
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}