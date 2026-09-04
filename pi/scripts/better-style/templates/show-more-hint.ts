import { getKeybindings } from "@earendil-works/pi-tui";

function formatKeyPart(part: string): string {
  return process.platform === "darwin" && part.toLowerCase() === "alt" ? "option" : part;
}

export function expandShortcutText(): string {
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

export function isToolTuiFullscreen(): boolean {
  return false;
}

export function setToolTuiFullscreen(_value: boolean): void {
  // Intentionally ignored: better-style never installs mouse interaction.
}
