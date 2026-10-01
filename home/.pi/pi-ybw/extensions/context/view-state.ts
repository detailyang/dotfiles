export type GraphView = "per-turn" | "cumulative-percent" | "cumulative-total";

export const GRAPH_VIEWS: GraphView[] = ["per-turn", "cumulative-percent", "cumulative-total"];

export type GraphViewKeyAction =
  | { type: "view"; view: GraphView }
  | { type: "refresh"; view: GraphView }
  | { type: "none"; view: GraphView };

export function graphViewLabel(view: GraphView): string {
  switch (view) {
    case "per-turn":
      return "Per-turn (%)";
    case "cumulative-percent":
      return "Cumulative (aggregate) %";
    case "cumulative-total":
      return "Cumulative (aggregate) total";
  }
}

export function nextGraphView(currentView: GraphView, direction: 1 | -1): GraphView {
  const idx = GRAPH_VIEWS.indexOf(currentView);
  const nextIndex = (idx + direction + GRAPH_VIEWS.length) % GRAPH_VIEWS.length;
  return GRAPH_VIEWS[nextIndex]!;
}

export function applyGraphViewKey(currentView: GraphView, data: string): GraphViewKeyAction {
  if (data === "r") {
    return { type: "refresh", view: currentView };
  }

  if (data === "1") {
    return { type: "view", view: "per-turn" };
  }

  if (data === "2") {
    return { type: "view", view: "cumulative-percent" };
  }

  if (data === "3") {
    return { type: "view", view: "cumulative-total" };
  }

  if (data === "v") {
    return { type: "view", view: nextGraphView(currentView, 1) };
  }

  if (data === "V") {
    return { type: "view", view: nextGraphView(currentView, -1) };
  }

  return { type: "none", view: currentView };
}
