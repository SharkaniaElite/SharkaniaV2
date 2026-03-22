// src/lib/render-inline-links.tsx
// Utility to parse markdown-style links [text](url) in blog content
// and render them as React Router <Link> or <a> elements

import { Link } from "react-router-dom";
import type { ReactNode } from "react";

const LINK_REGEX = /\[([^\]]+)\]\(([^)]+)\)/g;

export function renderWithLinks(text: string): ReactNode {
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  // Reset regex state
  LINK_REGEX.lastIndex = 0;

  while ((match = LINK_REGEX.exec(text)) !== null) {
    // Add text before the link
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    const linkText = match[1];
    const linkUrl = match[2];

    // Internal links use React Router <Link>, external use <a>
    if (linkUrl.startsWith("/")) {
      parts.push(
        <Link
          key={match.index}
          to={linkUrl}
          className="text-sk-accent hover:underline font-semibold"
        >
          {linkText}
        </Link>
      );
    } else {
      parts.push(
        <a
          key={match.index}
          href={linkUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sk-accent hover:underline font-semibold"
        >
          {linkText}
        </a>
      );
    }

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text after last link
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  // If no links found, return original string
  if (parts.length === 0) return text;

  return <>{parts}</>;
}
