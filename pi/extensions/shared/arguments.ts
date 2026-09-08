/** Split command arguments without shell expansion; preserve literal path backslashes. */
export function parseCommandArguments(value: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let started = false;
  let quote: "'" | '"' | null = null;
  for (let i = 0; i < value.length; i++) {
    const char = value[i];
    const next = value[i + 1];
    if (char === "\\" && quote !== "'" && next !== undefined &&
      (next === "\\" || next === '"' || (!quote && (next === "'" || /\s/.test(next))))) {
      current += next;
      started = true;
      i++;
    } else if (quote) {
      if (char === quote) quote = null;
      else current += char;
    } else if (char === "'" || char === '"') {
      quote = char;
      started = true;
    } else if (/\s/.test(char)) {
      if (started) tokens.push(current);
      current = "";
      started = false;
    } else {
      current += char;
      started = true;
    }
  }
  if (quote) throw new Error("Unterminated quoted argument");
  if (started) tokens.push(current);
  return tokens;
}
