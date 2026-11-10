/**
 * Unicode-aware word boundary helpers.
 *
 * Vietnamese text mixes Latin, diacritics and multi-syllable words, so the
 * boundary must be computed on Unicode letters/digits — not on ASCII only.
 * Matching is case-sensitive: renaming the character "An" must never touch the
 * word "an" or "Anh".
 */

const WORD_CHAR_END = /[\p{L}\p{N}_]$/u;
const WORD_CHAR_START = /^[\p{L}\p{N}_]/u;

/**
 * True when the range `[start, end)` of `text` is not glued to another word
 * character (Unicode letter, digit or underscore) on either side.
 */
export function isUnicodeWordBoundary(
  text: string,
  start: number,
  end: number
): boolean {
  const beforeOk = start <= 0 || !WORD_CHAR_END.test(text.slice(0, start));
  const afterOk = end >= text.length || !WORD_CHAR_START.test(text.slice(end));
  return beforeOk && afterOk;
}

/** Byte ranges of every standalone occurrence of `token` inside `text`. */
function findWholeWordOccurrences(
  text: string,
  token: string
): Array<[number, number]> {
  const occurrences: Array<[number, number]> = [];
  if (!token) return occurrences;

  let searchStart = 0;
  while (searchStart <= text.length - token.length) {
    const index = text.indexOf(token, searchStart);
    if (index === -1) break;
    const end = index + token.length;
    if (isUnicodeWordBoundary(text, index, end)) {
      occurrences.push([index, end]);
      searchStart = end;
    } else {
      searchStart = index + 1;
    }
  }
  return occurrences;
}

/** True when `text` contains `token` as a standalone word. */
export function containsWholeWordUnicode(text: string, token: string): boolean {
  return findWholeWordOccurrences(text, token).length > 0;
}

/** Replaces every standalone occurrence of `fromToken` with `toToken`. */
export function replaceWholeWordUnicode(
  text: string,
  fromToken: string,
  toToken: string
): string {
  const occurrences = findWholeWordOccurrences(text, fromToken);
  if (occurrences.length === 0) return text;

  let result = '';
  let cursor = 0;
  for (const [start, end] of occurrences) {
    result += text.slice(cursor, start) + toToken;
    cursor = end;
  }
  return result + text.slice(cursor);
}
