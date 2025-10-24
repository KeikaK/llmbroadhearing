import React from "react";
import styles from "./SimpleMarkdown.module.css";

export default function SimpleMarkdown({
  content,
  className,
}: {
  content?: string | null;
  className?: string;
}) {
  const raw = String(content ?? "");

  const escapeHtml = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  // エスケープ後に **bold** / __bold__ のみを <strong class="..."> に変換
  const escaped = escapeHtml(raw);
  const html = escaped.replace(/(\*\*|__)(.+?)\1/g, (_m, _delim, inner) => {
    return `<strong class="${styles.gradientBold}">${inner}</strong>`;
  });

  return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}