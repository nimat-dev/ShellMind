/**
 * Cleans assistant response text by removing markdown formatting, code fences,
 * tool output artifacts, and caps the text to a concise, human-spoken summary.
 */
export function extractSpokenSummary(text: string, maxChars = 300): string {
  if (!text || typeof text !== "string") {
    return "";
  }

  // 1. Remove fenced code blocks (```lang ... ```)
  let cleaned = text.replace(/```[\s\S]*?```/g, " ");

  // 2. Remove inline code (`code`)
  cleaned = cleaned.replace(/`([^`]+)`/g, "$1");

  // 3. Remove markdown links and images ([text](url) -> text, ![alt](url) -> "")
  cleaned = cleaned.replace(/!\[.*?\]\(.*?\)/g, " ");
  cleaned = cleaned.replace(/\[(.*?)\]\(.*?\)/g, "$1");

  // 4. Remove bold / italic formatting (**bold** -> bold, *italic* -> italic)
  cleaned = cleaned.replace(/(\*\*|__)(.*?)\1/g, "$2");
  cleaned = cleaned.replace(/(\*|_)(.*?)\1/g, "$2");

  // 5. Remove headers, quotes, and bullet markers
  cleaned = cleaned.replace(/^[#>-]+\s+/gm, " ");
  cleaned = cleaned.replace(/^\s*[-*+]\s+/gm, " ");
  cleaned = cleaned.replace(/^\s*\d+\.\s+/gm, " ");

  // 6. Remove raw JSON structures if accidentally leaked
  cleaned = cleaned.replace(/\{[\s\S]*?\}/g, " ");

  // 7. Collapse all whitespace into single spaces and trim
  cleaned = cleaned.replace(/\s+/g, " ").trim();

  if (!cleaned) {
    return "";
  }

  // 8. If cleaned text is within bounds, return directly
  if (cleaned.length <= maxChars) {
    return cleaned;
  }

  // 9. If text exceeds maxChars, check for sentence boundaries within maxChars
  const sentenceSlice = cleaned.slice(0, maxChars);
  const punctuationMatches = [...sentenceSlice.matchAll(/[.!?](?=\s|$)/g)];
  const validEnds = punctuationMatches.filter(
    (m) => m.index !== undefined && m.index >= 40 && m.index <= maxChars - 1
  );

  if (validEnds.length > 0) {
    const lastPunctuation = validEnds[validEnds.length - 1];
    if (lastPunctuation && lastPunctuation.index !== undefined) {
      return cleaned.slice(0, lastPunctuation.index + 1).trim();
    }
  }

  // 10. Fallback: cut at the last word break before maxChars - 3 and append ellipsis
  const targetLen = Math.max(0, maxChars - 3);
  const fallbackSlice = cleaned.slice(0, targetLen);
  const lastSpace = fallbackSlice.lastIndexOf(" ");
  if (lastSpace > 40) {
    return cleaned.slice(0, lastSpace).trim() + "...";
  }

  return fallbackSlice.trim() + "...";
}
