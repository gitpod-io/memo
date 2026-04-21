const WORDS_PER_MINUTE = 200;

/**
 * Count words in a text string by splitting on whitespace
 * and filtering empty strings.
 */
export function getWordCount(text: string): number {
  if (!text) return 0;
  return text.split(/\s+/).filter((word) => word.length > 0).length;
}

/**
 * Estimate reading time in minutes based on word count.
 * Returns at least 1 minute for any non-zero word count.
 */
export function getReadingTime(wordCount: number): number {
  if (wordCount === 0) return 0;
  return Math.max(1, Math.ceil(wordCount / WORDS_PER_MINUTE));
}

/**
 * Format word count and reading time as a display string.
 */
export function formatWordCountDisplay(wordCount: number): string {
  const readingTime = getReadingTime(wordCount);
  if (wordCount === 0) return "0 words";
  const wordLabel = wordCount === 1 ? "word" : "words";
  const minuteLabel = readingTime === 1 ? "min" : "min";
  return `${wordCount} ${wordLabel} · ${readingTime} ${minuteLabel} read`;
}
