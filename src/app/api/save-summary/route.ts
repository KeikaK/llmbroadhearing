import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { ChatOpenAI } from "@langchain/openai";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";

/**
 * POST /api/save-summary
 * - 受け取った会話ログを LLM で要約し、その要約を該当セッションファイルの `summary` に書き込むバックグラウンド用エンドポイント。
 *
 * 注意点（運用上のポイント）:
 * - file は必須。外部から渡される file 名はパス付きや ../ を含む可能性があるため、
 *   実運用では ensureJsonFilename 等で正規化・バリデーションすることを推奨します。
 * - LLM 呼び出しはコストが発生するため非同期で呼ぶ用途に適しています（クライアントは即座に OK を受け取らない想定）。
 * - 会話をそのままプロンプトに含めると長くなるため先頭 4000 文字でトリムしています。必要に応じてトークン管理を導入してください。
 */
export async function POST(req: NextRequest) {
  try {
    // リクエストボディ: { file, messages, question? }
    const body = await req.json();
    const fileName = body?.file;
    const messages = Array.isArray(body?.messages) ? body.messages : [];
    const question = body?.question ?? null;

    if (!fileName) {
      // クライアント側の送信ミス等に備えて 400 を返す
      return NextResponse.json({ ok: false, message: "missing file" }, { status: 400 });
    }

    // 会話を平文化して結合（長すぎる場合は切り詰め）
    // ここでは簡潔化のため文字数でトリムしているが、トークンベースで管理するほうが確実
    const conv = messages
      .map((m: any) => `${m.role === "user" ? "ユーザー" : m.role === "assistant" ? "AI" : "システム"}: ${m.content}`)
      .join("\n")
      .slice(0, 4000);

    // プロンプトの作成:
    // - ユーザー視点を強調し、約100文字で要約するよう指示
    // - question があればテンプレ情報を付与して要約精度を高める
    let humanText = `以下の会話ログを「ユーザー視点」で要約してください。特に「ユーザーが何を感じ、何を望み、どのような行動（次の具体的な一歩）を取りたいか」を強調し、日本語で約100文字にまとめてください。\n\n会話ログ:\n${conv}\n`;
    if (question) {
      humanText += `\nテンプレート情報:\nタイトル: ${question.title ?? ""}\n説明: ${question.description ?? ""}\n`;
    }
    humanText += `\n出力は日本語で100文字前後の要約のみを返してください。余計な注釈や補足は不要です。`;

    // LangChain ChatOpenAI の初期化:
    // - model / apiKey は環境変数で設定（デフォルトは gpt-5-nano）
    // - streaming: false（同期で結果を受け取る）
    const llm = new ChatOpenAI({
      model: process.env.LLM_MODEL ?? "gpt-5-nano",
      apiKey: process.env.OPENAI_API_KEY,
      streaming: false,
    });

    // LLM 呼び出し（SystemMessage で役割を明示）
    const result: any = await llm.invoke([new SystemMessage("あなたは要約の専門家です。"), new HumanMessage(humanText)]);

    // LangChain の戻り値は様々な形があるため安全に文字列を取り出す
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

    // デバッグログ: 生成要約の確認
    try {
      console.log("[api/save-summary] generated summary:", summary);
    } catch (e) {
      console.warn("[api/save-summary] failed to log summary:", String(e));
    }

    // セッションファイルを読み出して summary を注入して上書き保存
    // セキュリティ注意: fileName に ../ 等が含まれると任意ファイル上書きの危険があるため
    // 実運用では必ずファイル名検証（ホワイトリスト化や ensureJsonFilename の利用）を行うこと。
    const filePath = path.join(process.cwd(), "data", "sessions", String(fileName));
    try {
      const txt = await fs.readFile(filePath, "utf8");
      const json = JSON.parse(txt);
      json.summary = summary;
      await fs.writeFile(filePath, JSON.stringify(json, null, 2), "utf8");
      console.log("[api/save-summary] updated file with summary:", filePath, "summary length:", summary.length);
      return NextResponse.json({ ok: true });
    } catch (e: any) {
      // ファイル読み書きやパース失敗時は 500 を返す
      console.error("[api/save-summary] failed to update file:", e);
      return NextResponse.json({ ok: false, message: String(e) }, { status: 500 });
    }
  } catch (e: any) {
    // 想定外のエラーは 500
    console.error("[api/save-summary] error:", e);
    return NextResponse.json({ ok: false, message: e?.message ?? String(e) }, { status: 500 });
  }
}