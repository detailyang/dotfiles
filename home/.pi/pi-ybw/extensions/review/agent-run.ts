import { runAgentProcess, type AgentProcessChild, type SpawnAgentProcess } from "../shared/agent-process.ts";

export type ReviewAgentEvent =
  | { type: "assistant"; text: string }
  | { type: "status"; text: string };

export interface ParallelReviewOptions {
  stdin?: string;
  cwd?: string;
  noTools?: boolean;
  noSkills?: boolean;
  signal?: AbortSignal;
  timeoutMs?: number;
  killGraceMs?: number;
}

export type ReviewAgentChild = AgentProcessChild;
export type SpawnReviewAgent = SpawnAgentProcess;

export function buildReviewAgentArgs(model: string, prompt: string, options: ParallelReviewOptions): string[] {
  const args = ["--mode", "json", "-p", "--no-session"];
  if (options.noTools) args.push("--no-tools");
  if (options.noSkills) args.push("--no-skills");
  args.push("--model", model, prompt);
  return args;
}

export async function runReviewAgentProcess(
  model: string,
  prompt: string,
  options: ParallelReviewOptions,
  onEvent: (event: ReviewAgentEvent) => void,
  signal: AbortSignal,
  parseLine: (line: string) => ReviewAgentEvent | null,
  spawnReviewAgent?: SpawnReviewAgent,
): Promise<void> {
  await runAgentProcess({
    command: "pi", args: buildReviewAgentArgs(model, prompt, options),
    cwd: options.cwd, stdin: options.stdin,
    signal: options.signal ? AbortSignal.any([signal, options.signal]) : signal,
    timeoutMs: options.timeoutMs, killGraceMs: options.killGraceMs,
  }, (line) => {
    const event = parseLine(line);
    if (event) onEvent(event);
  }, spawnReviewAgent);
}
