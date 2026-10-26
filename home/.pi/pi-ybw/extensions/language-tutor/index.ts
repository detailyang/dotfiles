/**
 * Entry point. The implementation lives in src/:
 * - src/core.ts      — pure logic (heuristics, prompts, parsing, card assembly)
 * - src/config.ts    — config persistence
 * - src/llm.ts       — model resolution, LLM calls, session-fork tracking
 * - src/grammar.ts   — the unified review: dispatches "✏ Writing check" and "✏ Writing tutor"
 * - src/tutor.ts     — the "✏ Writing tutor" widget renderer
 * - src/translate.ts — bilingual translation cards
 * - src/flashcards.ts, src/flashcard-settings.ts — flashcard persistence and FSRS scheduling
 * - src/learn.ts     — /flashcards review window (glimpseui)
 * - src/settings.ts  — /lang command, settings menu, status bar
 * - src/index.ts     — composition root wiring the features together
 *
 * See ATTRIBUTION.md for provenance.
 */

import languageTutor from "./src/index.ts";

export * from "./src/core.ts";
export default languageTutor;
