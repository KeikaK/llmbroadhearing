/**
 * セッション関連の型定義
 * - Message: 会話の各メッセージ（保存ファイル内の要素）
 * - SessionFile: セッション JSON ファイルのトップレベル構造
 *
 * ここはサーバー／クライアント両方で参照されるため軽量かつ柔軟にしてあります。
 */

export type Message = {
  // 送信者の役割 (例: "user" | "assistant" | "system")
  role?: string;

  // メインの本文（一般的に表示に使う）
  content?: string;

  // 旧フォーマットや別キーで保存されている場合があるテキスト
  text?: string;

  // タイムスタンプ（ISO 文字列など）。表示用に Date に変換して使う
  time?: string;

  // sender と role の二重保持があるデータに対応するための別名
  sender?: string;

  // 将来の拡張プロパティを許容
  [key: string]: any;
};

export type SessionFile = {
  // ファイルがエクスポートされた日時（ISO 文字列）
  exportedAt?: string;

  // 会話配列
  messages?: Message[];

  // チャットに紐づく質問テンプレ等のメタ情報（任意の構造）
  question?: Record<string, any>;

  // 表示用タイトル
  title?: string;

  // 外部で生成された要約（存在すれば表示）
  summary?: string;

  // 将来の拡張プロパティを許容
  [key: string]: any;
};