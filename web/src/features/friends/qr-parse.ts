/** The username inside a scanned Tabiato friend link, or null if the code is something else. */
export function handleFromScan(text: string): string | null {
  const m = text.match(/\/u\/([a-z0-9_]{3,24})(?:[/?#]|$)/i);
  return m ? m[1].toLowerCase() : null;
}
