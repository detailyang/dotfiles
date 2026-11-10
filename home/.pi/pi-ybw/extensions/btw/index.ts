import type {
  ExtensionAPI,
  ExtensionCommandContext,
} from "@earendil-works/pi-coding-agent";

import { openHerdrBtw } from "./herdr.ts";
import { openRexBtw } from "./rex.ts";
import {
  report,
  resolveBtwHost,
  type BtwLocation,
  type RexLocation,
} from "./shared.ts";

type LocationChoice<L extends string> = { label: string; location: L };

const HERDR_LOCATIONS: ReadonlyArray<LocationChoice<BtwLocation>> = [
  { label: "New pane in current tab", location: "pane" },
  { label: "New tab", location: "tab" },
];

const REX_LOCATIONS: ReadonlyArray<LocationChoice<RexLocation>> = [
  { label: "Floating window", location: "float" },
  ...HERDR_LOCATIONS,
];

async function chooseLocation<L extends string>(
  ctx: ExtensionCommandContext,
  choices: ReadonlyArray<LocationChoice<L>>,
): Promise<L | undefined> {
  const choice = await ctx.ui.select(
    "Open BTW in:",
    choices.map(({ label }) => label),
  );
  if (choice === undefined) {
    report(ctx, "BTW cancelled.", "info");
    return undefined;
  }

  const location = choices.find(({ label }) => label === choice)?.location;
  if (!location) {
    report(ctx, `Cannot open BTW: unknown location ${choice}.`, "error");
    return undefined;
  }

  return location;
}

export function registerBtwExtension(
  pi: ExtensionAPI,
  env: NodeJS.ProcessEnv,
): void {
  const handler = async (args: string, ctx: ExtensionCommandContext): Promise<void> => {
    if (!ctx.hasUI) return;

    const host = resolveBtwHost(env);
    if ("error" in host) {
      report(ctx, `Cannot open BTW: ${host.error}`, "error");
      return;
    }

    const parentSessionFile = ctx.sessionManager.getSessionFile();
    if (!parentSessionFile) {
      report(ctx, "Cannot fork BTW: the current Pi session is not persisted.", "error");
      return;
    }

    const question = args.trim();
    if (host.provider === "herdr") {
      const location = await chooseLocation(ctx, HERDR_LOCATIONS);
      if (!location) return;
      await openHerdrBtw(pi, ctx, host, location, parentSessionFile, question);
      return;
    }

    const location = await chooseLocation(ctx, REX_LOCATIONS);
    if (!location) return;
    await openRexBtw(pi, ctx, host, location, parentSessionFile, question);
  };

  pi.registerCommand("btw", {
    description: "Fork the current Pi conversation into a new pane, tab, or Rex floating window.",
    handler,
  });
}

export default function btwExtension(pi: ExtensionAPI): void {
  registerBtwExtension(pi, process.env);
}
