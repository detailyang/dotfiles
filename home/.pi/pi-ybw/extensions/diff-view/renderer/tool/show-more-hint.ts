import { getKeybindings } from "@earendil-works/pi-tui";

function formatKeyPart(part: string): string {
  return process.platform === "darwin" && part.toLowerCase() === "alt" ? "option" : part;
}

function expandShortcutText(): string {
  const keys = getKeybindings().getKeys("app.tools.expand");
  if (keys.length === 0) return "ctrl+o";
  return keys
    .join("/")
    .split("/")
    .map((part) => part.split("+").map(formatKeyPart).join("+"))
    .join("/");
}

export function showMoreHintText(): string {
  return `${expandShortcutText()} to show more`;
}
