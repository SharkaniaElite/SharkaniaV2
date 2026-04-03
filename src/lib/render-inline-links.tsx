// src/lib/render-inline-links.tsx
// Utility to parse markdown-style links [text](url) in blog content
// and render them as React Router <Link> or <a> elements
// Also supports automatic glossary term linking with tooltips

import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import { GlossaryTooltip } from "../components/blog/glossary-tooltip";
import type { GlossaryTerm } from "./api/glossary";

const LINK_REGEX = /\[([^\]]+)\]\(([^)]+)\)/g;

/**
 * Original function — renders markdown links only.
 * Used in non-blog contexts where glossary linking is not needed.
 */
export function renderWithLinks(text: string): ReactNode {
  return processMarkdownLinks(text);
}

/**
 * Enhanced function — renders markdown links AND glossary tooltips.
 * Used in blog posts where glossary terms should be auto-linked.
 */
export function renderWithLinksAndGlossary(
  text: string,
  glossaryTerms: GlossaryTerm[],
  alreadyLinked: Set<string>
): ReactNode {
  // Step 1: Process markdown links first
  const partsAfterLinks = processMarkdownLinksToArray(text);

  // Step 2: For each text-only part, detect glossary terms
  const finalParts: ReactNode[] = [];

  for (let i = 0; i < partsAfterLinks.length; i++) {
    const part = partsAfterLinks[i];

    // If it's already a React element (a link), keep it as-is
    if (typeof part !== "string") {
      finalParts.push(part);
      continue;
    }

    // For plain text, search for glossary terms
    const withGlossary = applyGlossaryLinks(part, glossaryTerms, alreadyLinked, i);
    finalParts.push(...withGlossary);
  }

  if (finalParts.length === 0) return text;
  if (finalParts.length === 1 && typeof finalParts[0] === "string") return text;

  return <>{finalParts}</>;
}

// ── Internal helpers ─────────────────────────────────────

function processMarkdownLinks(text: string): ReactNode {
  const parts = processMarkdownLinksToArray(text);
  if (parts.length === 0) return text;
  if (parts.length === 1 && typeof parts[0] === "string") return text;
  return <>{parts}</>;
}

function processMarkdownLinksToArray(text: string): (string | ReactNode)[] {
  const parts: (string | ReactNode)[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  LINK_REGEX.lastIndex = 0;

  while ((match = LINK_REGEX.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    const linkText = match[1];
    const linkUrl = match[2];

    if (linkUrl.startsWith("/")) {
      parts.push(
        <Link
          key={`link-${match.index}`}
          to={linkUrl}
          className="text-sk-accent hover:underline font-semibold"
        >
          {linkText}
        </Link>
      );
    } else {
      parts.push(
        <a
          key={`link-${match.index}`}
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

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  if (parts.length === 0) {
    parts.push(text);
  }

  return parts;
}

/**
 * Scans a plain text string for glossary terms and wraps the first
 * occurrence of each term with a GlossaryTooltip.
 * 
 * Rules:
 * - Each term is linked only ONCE per article (tracked via alreadyLinked set)
 * - Case-insensitive matching
 * - Only matches whole words (word boundary)
 * - Skips terms shorter than 2 characters to avoid false positives
 */
function applyGlossaryLinks(
  text: string,
  terms: GlossaryTerm[],
  alreadyLinked: Set<string>,
  partIndex: number
): ReactNode[] {
  if (!text || terms.length === 0) return [text];

  // Sort terms by length descending so longer terms match first
  // e.g., "Game Selection" matches before "Game"
  const sortedTerms = [...terms]
    .filter((t) => t.term.length >= 2 && !alreadyLinked.has(t.slug))
    .sort((a, b) => b.term.length - a.term.length);

  if (sortedTerms.length === 0) return [text];

  // Try to find the first matching term in this text
  for (const term of sortedTerms) {
    // Build regex for whole-word case-insensitive match
    const escaped = term.term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\b(${escaped})\\b`, "i");
    const match = regex.exec(text);

    if (match && match.index !== undefined) {
      // Mark as linked so it doesn't get linked again in this article
      alreadyLinked.add(term.slug);

      const before = text.slice(0, match.index);
      const matched = match[1];
      const after = text.slice(match.index + matched.length);

      const result: ReactNode[] = [];

      // Recursively process the part before the match (might contain other terms)
      if (before) {
        result.push(...applyGlossaryLinks(before, terms, alreadyLinked, partIndex));
      }

      // The tooltip-wrapped term
      result.push(
        <GlossaryTooltip
          key={`glossary-${term.slug}-${partIndex}`}
          term={term.term}
          slug={term.slug}
          shortDefinition={term.short_definition}
        >
          {matched}
        </GlossaryTooltip>
      );

      // Recursively process the part after the match
      if (after) {
        result.push(...applyGlossaryLinks(after, terms, alreadyLinked, partIndex));
      }

      return result;
    }
  }

  // No match found, return text as-is
  return [text];
}
