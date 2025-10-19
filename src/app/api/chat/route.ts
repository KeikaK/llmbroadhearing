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


const llm = new ChatOpenAI({
model: "gpt-4o-mini", // 任意で変更可
temperature: 0.2,
apiKey: process.env.OPENAI_API_KEY,
});


const ai = await llm.invoke(lcMessages.length ? lcMessages : [
new SystemMessage("ここに最初のプロンプトをかく"),
new HumanMessage("ヒアリングを始めてください"),
]);


return NextResponse.json({ reply: ai.content }, { status: 200 });
} catch (e: any) {
console.error(e);
return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
}
}