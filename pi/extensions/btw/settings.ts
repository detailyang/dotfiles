import type { BtwModelRef, SessionThinkingLevel } from "./command.js";

export type BtwModelSource = "override" | "main" | "none";

export type ResolvedBtwModel<TModel extends BtwModelRef = BtwModelRef> = {
  model: TModel | null;
  source: BtwModelSource;
  configuredOverride: TModel | null;
  fallbackReason?: string;
};

export type ResolvedBtwSettings<TModel extends BtwModelRef = BtwModelRef> = {
  model: TModel | null;
  modelSource: BtwModelSource;
  configuredModelOverride: TModel | null;
  thinkingLevel: SessionThinkingLevel;
  thinkingSource: "override" | "main";
  fallbackReason?: string;
};

export function formatModelRef(model: Pick<BtwModelRef, "provider" | "id" | "api">): string {
  return `${model.provider}/${model.id} (${model.api})`;
}

export function resolveBtwModelWithCredentialStatus<TModel extends BtwModelRef>({
  configuredOverride,
  mainModel,
  overrideHasCredentials,
}: {
  configuredOverride: TModel | null;
  mainModel: TModel | null;
  overrideHasCredentials?: boolean;
}): ResolvedBtwModel<TModel> {
  if (configuredOverride) {
    if (overrideHasCredentials) {
      return {
        model: configuredOverride,
        source: "override",
        configuredOverride,
      };
    }

    const fallbackReason = mainModel
      ? `Configured BTW model ${formatModelRef(configuredOverride)} has no credentials. Falling back to main model ${formatModelRef(
          mainModel,
        )}.`
      : `Configured BTW model ${formatModelRef(configuredOverride)} has no credentials, and no main model is active.`;

    if (mainModel) {
      return {
        model: mainModel,
        source: "main",
        configuredOverride,
        fallbackReason,
      };
    }

    return {
      model: null,
      source: "none",
      configuredOverride,
      fallbackReason,
    };
  }

  if (mainModel) {
    return {
      model: mainModel,
      source: "main",
      configuredOverride: null,
    };
  }

  return {
    model: null,
    source: "none",
    configuredOverride: null,
  };
}

export function buildResolvedBtwSettings<TModel extends BtwModelRef>(
  resolvedModel: ResolvedBtwModel<TModel>,
  mainThinkingLevel: SessionThinkingLevel,
  thinkingOverride: SessionThinkingLevel | null,
): ResolvedBtwSettings<TModel> {
  return {
    model: resolvedModel.model,
    modelSource: resolvedModel.source,
    configuredModelOverride: resolvedModel.configuredOverride,
    thinkingLevel: thinkingOverride ?? mainThinkingLevel,
    thinkingSource: thinkingOverride ? "override" : "main",
    fallbackReason: resolvedModel.fallbackReason,
  };
}

export function describeResolvedBtwModel(settings: ResolvedBtwSettings): string {
  if (!settings.model) {
    if (settings.configuredModelOverride && settings.fallbackReason) {
      return `BTW model unavailable. ${settings.fallbackReason}`;
    }
    return "BTW model unavailable. No active model selected.";
  }

  const source =
    settings.modelSource === "override"
      ? "override"
      : settings.configuredModelOverride
        ? "inherited fallback"
        : "inherits main thread";
  return `BTW model: ${formatModelRef(settings.model)} (${source}).${
    settings.fallbackReason ? ` ${settings.fallbackReason}` : ""
  }`;
}

export function describeResolvedBtwThinking(settings: ResolvedBtwSettings): string {
  const source = settings.thinkingSource === "override" ? "override" : "inherits main thread";
  return `BTW thinking: ${settings.thinkingLevel} (${source}).`;
}
