"use client";
import Link from "next/link";

export default function Home() {
  return (
    <main style={{
      display: "grid",
      placeItems: "center",
      height: "100svh",
      background: "#eef2f6",
    }}>
      <div style={{
        width: 640,
        background: "#fff",
        border: "1px solid #e2e6ee",
        borderRadius: 16,
        boxShadow: "0 10px 30px rgba(0,0,0,.05)",
        padding: 28
      }}>
        <h1 style={{ fontSize: 28, margin: "0 0 8px", fontWeight: 800 }}>
          LLMBroadHearing
        </h1>
        <p style={{ color: "#555", margin: "0 0 20px" }}>
          アンケート深掘りAIチャットへようこそ。PC向けに最適化されたUIです。
        </p>

        <ul style={{ color: "#6b7280", margin: "0 0 24px", lineHeight: 1.7 }}>
          <li>Enterで送信 / Shift+Enterで改行</li>
          <li>読みやすいデスクトップ配色と余白</li>
          <li>スクロールバー＆ホバー・フォーカス可視</li>
        </ul>

        <Link href="/chat">
          <button style={{
            padding: "14px 26px",
            fontSize: 16,
            borderRadius: 10,
            border: "1px solid #06c755",
            background: "#06c755",
            color: "#fff",
            cursor: "pointer",
            transition: "filter .15s ease, transform .05s ease",
          }}
          onMouseDown={(e) => (e.currentTarget.style.transform = "translateY(1px)")}
          onMouseUp={(e) => (e.currentTarget.style.transform = "")}
          onMouseEnter={(e) => (e.currentTarget.style.filter = "brightness(1.05)")}
          onMouseLeave={(e) => { e.currentTarget.style.filter = ""; e.currentTarget.style.transform = ""; }}
          >
            チャットを開始する
          </button>
        </Link>
      </div>
    </main>
  );
}
