/**
 * session.ts
 * - data/sessions フォルダ内の JSON セッションファイルを安全に読み込むユーティリティ
 * - サーバーサイド (Node.js) で実行されることを想定しています
 * - ファイル名の正規化（.json 付与）や存在確認を提供します
 */

import fs from "fs/promises";
import path from "path";
import { SessionFile } from "../types/session";

/**
 * ensureJsonFilename
 * - 空文字はエラー
 * - 拡張子がなければ .json を付与して返す
 * - 呼び出し元でパス侵入（../）チェックが必要な場合はここで追加可能
 */
export function ensureJsonFilename(name: string) {
  if (!name) throw new Error("missing filename");
  return name.endsWith(".json") ? name : `${name}.json`;
}

/**
 * readSessionFile
 * - data/sessions ディレクトリから指定ファイルを読み込み JSON を返す
 * - ファイルが見つからない、読み取り失敗、JSON パースエラーは呼び出し元でハンドルする
 * - 戻り値は型 SessionFile としてキャストする（型定義は src/types/session.ts）
 */
export async function readSessionFile(filename: string): Promise<SessionFile> {
  const safe = ensureJsonFilename(String(filename));
  const dataDir = path.join(process.cwd(), "data", "sessions");
  const filePath = path.join(dataDir, safe);
  const txt = await fs.readFile(filePath, "utf8");
  return JSON.parse(txt) as SessionFile;
}

/**
 * statSessionFile
 * - ファイルの存在確認を行うユーティリティ
 * - 存在すれば true、存在しなければ false を返す（例外は swallow）
 */
export async function statSessionFile(filename: string): Promise<boolean> {
  const safe = ensureJsonFilename(String(filename));
  const dataDir = path.join(process.cwd(), "data", "sessions");
  const filePath = path.join(dataDir, safe);
  try {
    await fs.stat(filePath);
    return true;
  } catch {
    return false;
  }
}