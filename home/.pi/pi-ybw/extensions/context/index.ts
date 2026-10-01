import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { renderGraphBody } from "./graph-view.js";
import { ScrollDialog } from "./scroll-dialog.js";
import { collectCacheSessionMetrics } from "./session-data.js";
import { applyGraphViewKey, graphViewLabel, type GraphView } from "./view-state.js";

export default function contextExtension(pi: ExtensionAPI): void {
  pi.registerCommand("context", {
    description: "Show context cache hit graph for the current session",
    getArgumentCompletions(prefix) {
      const items = [
        { value: "graph", label: "graph", description: "Show cache hit % graph over time" },
      ];
      const filtered = items.filter((item) => item.value.startsWith(prefix.toLowerCase()));
      return filtered.length > 0 ? filtered : items;
    },
    handler: async (_args, ctx) => {
      if (ctx.mode !== "tui") {
        ctx.ui.notify("/context requires interactive TUI mode.", "info");
        return;
      }

      let metrics = collectCacheSessionMetrics(ctx.sessionManager);
      let currentView: GraphView = "per-turn";

      await ctx.ui.custom<void>(
        (_tui, theme, _keybindings, done) =>
          new ScrollDialog(
            theme,
            {
              title: "Context Cache Graph",
              getTitle: () => `Context Cache Graph — ${graphViewLabel(currentView)}`,
              helpText: "1/2/3 view • r refresh • v cycle • ↑/↓ scroll • PgUp/PgDn • q/Esc close",
              renderBody: (innerWidth) => renderGraphBody(theme, metrics, innerWidth, currentView),
              onKey: (data) => {
                const action = applyGraphViewKey(currentView, data);
                if (action.type === "none") {
                  return false;
                }

                if (action.type === "refresh") {
                  metrics = collectCacheSessionMetrics(ctx.sessionManager);
                }

                currentView = action.view;
                return true;
              },
            },
            () => done(undefined),
          ),
        {
          overlay: true,
          overlayOptions: {
            anchor: "center",
            width: "90%",
            maxHeight: "90%",
            margin: 1,
          },
        },
      );
    },
  });
}
