// Ported from mackt/pi-language-tutor test/flashcards.test.ts (Vitest -> node:test).
// See extensions/language-tutor/ATTRIBUTION.md for provenance.
import assert from "node:assert/strict";
import test from "node:test";
import {
  addCard,
  addCards,
  cardStats,
  deleteCard,
  getDueCards,
  listCards,
  mergeCards,
  needsRetry,
  Rating,
  rateCard,
  updateCard,
} from "../extensions/language-tutor/src/flashcards.ts";
import type { FlashcardEntry } from "../extensions/language-tutor/src/flashcards.ts";
import { clampSettings, DEFAULT_SETTINGS } from "../extensions/language-tutor/src/flashcard-settings.ts";

function makeCard(word: string, note = "a note"): FlashcardEntry {
  const cards: FlashcardEntry[] = [];
  addCard(cards, word, note);
  return cards[0];
}

test("addCard", async (t) => {
  await t.test("adds a card with trimmed word and note", () => {
    const cards: FlashcardEntry[] = [];
    assert.equal(addCard(cards, "  hola  ", "  hello  "), true);
    assert.equal(cards.length, 1);
    assert.equal(cards[0].word, "hola");
    assert.equal(cards[0].note, "hello");
  });

  await t.test("dedupes by word, case-insensitive", () => {
    const cards: FlashcardEntry[] = [];
    assert.equal(addCard(cards, "Hola", "hello"), true);
    assert.equal(addCard(cards, "hola", "hi again"), false);
    assert.equal(addCard(cards, "  HOLA ", "hi again"), false);
    assert.equal(cards.length, 1);
  });

  await t.test("rejects empty word or note", () => {
    const cards: FlashcardEntry[] = [];
    assert.equal(addCard(cards, "", "note"), false);
    assert.equal(addCard(cards, "   ", "note"), false);
    assert.equal(addCard(cards, "word", ""), false);
    assert.equal(addCard(cards, "word", "  "), false);
    assert.equal(cards.length, 0);
  });

  await t.test("addCards returns the count actually added", () => {
    const cards: FlashcardEntry[] = [];
    const n = addCards(cards, [
      { word: "uno", note: "one" },
      { word: "dos", note: "two" },
      { word: "UNO", note: "dup" },
    ]);
    assert.equal(n, 2);
    assert.equal(cards.length, 2);
  });
});

test("getDueCards / cardStats", async (t) => {
  await t.test("new cards are always due", () => {
    const cards = [makeCard("a"), makeCard("b")];
    assert.equal(getDueCards(cards).length, 2);
    assert.deepEqual(cardStats(cards), { total: 2, due: 2, newCards: 2, lastReview: null, nextDue: null });
  });

  await t.test("a reviewed card with a future due date is not due", () => {
    const card = makeCard("a");
    rateCard(card, Rating.Easy);
    assert.notEqual(card.fsrs.state, 0);
    assert.ok(card.fsrs.due.getTime() > Date.now());
    assert.equal(getDueCards([card]).length, 0);
    const stats = cardStats([card]);
    assert.equal(stats.total, 1);
    assert.equal(stats.due, 0);
    assert.equal(stats.newCards, 0);
    assert.notEqual(stats.lastReview, null);
    assert.equal(stats.nextDue, card.fsrs.due.toISOString());
  });

  await t.test("a reviewed card with a past due date is due", () => {
    const card = makeCard("a");
    rateCard(card, Rating.Easy);
    card.fsrs.due = new Date(Date.now() - 1000);
    assert.equal(getDueCards([card]).length, 1);
  });

  await t.test("respects the limit", () => {
    const cards = Array.from({ length: 25 }, (_, i) => makeCard(`w${i}`));
    assert.equal(getDueCards(cards, 20).length, 20);
    assert.equal(getDueCards(cards).length, 20);
  });
});

test("updateCard", async (t) => {
  await t.test("updates word and note, trimmed", () => {
    const card = makeCard("a");
    assert.equal(updateCard(card, "  new word ", " new note "), true);
    assert.equal(card.word, "new word");
    assert.equal(card.note, "new note");
  });

  await t.test("rejects empty input and leaves the card unchanged", () => {
    const card = makeCard("a", "original note");
    assert.equal(updateCard(card, "", "note"), false);
    assert.equal(updateCard(card, "word", "  "), false);
    assert.equal(card.word, "a");
    assert.equal(card.note, "original note");
  });
});

test("deleteCard", async (t) => {
  await t.test("removes the card by id", () => {
    const a = makeCard("a");
    const b = makeCard("b");
    const cards = [a, b];
    assert.equal(deleteCard(cards, a.id), true);
    assert.deepEqual(cards.map((c) => c.word), ["b"]);
  });

  await t.test("returns false for unknown id", () => {
    const cards = [makeCard("a")];
    assert.equal(deleteCard(cards, "nope"), false);
    assert.equal(cards.length, 1);
  });
});

test("needsRetry", async (t) => {
  await t.test("Again and Hard keep the card in the session", () => {
    assert.equal(needsRetry(Rating.Again), true);
    assert.equal(needsRetry(Rating.Hard), true);
  });

  await t.test("Good and Easy graduate the card", () => {
    assert.equal(needsRetry(Rating.Good), false);
    assert.equal(needsRetry(Rating.Easy), false);
  });
});

test("rateCard", async (t) => {
  await t.test("updates FSRS state and schedules a future review", () => {
    const card = makeCard("a");
    rateCard(card, Rating.Good);
    assert.equal(card.fsrs.reps, 1);
    assert.ok(card.fsrs.last_review instanceof Date);
    assert.ok(card.fsrs.due.getTime() > Date.now());
  });

  await t.test("a single rating graduates a new card to a day-level interval", () => {
    const card = makeCard("a");
    rateCard(card, Rating.Good);
    assert.equal(card.fsrs.state, 2 /* Review */);
    assert.ok(card.fsrs.due.getTime() > Date.now() + 24 * 60 * 60 * 1000);
  });

  await t.test("even Again graduates, with the shortest interval", () => {
    const card = makeCard("a");
    rateCard(card, Rating.Again);
    assert.equal(card.fsrs.state, 2 /* Review */);
    assert.ok(card.fsrs.due.getTime() > Date.now() + 12 * 60 * 60 * 1000);
  });
});

test("clampSettings", async (t) => {
  await t.test("returns defaults for garbage input", () => {
    assert.deepEqual(clampSettings(null), DEFAULT_SETTINGS);
    assert.deepEqual(clampSettings("junk"), DEFAULT_SETTINGS);
    assert.deepEqual(clampSettings({ newPerDay: "lots" }), DEFAULT_SETTINGS);
  });

  await t.test("clamps to sane ranges", () => {
    assert.deepEqual(clampSettings({ newPerDay: -5, sessionLimit: 9999, requestRetention: 0.5 }), {
      newPerDay: 0,
      sessionLimit: 200,
      requestRetention: 0.7,
      theme: "system",
    });
    assert.equal(clampSettings({ requestRetention: 0.99 }).requestRetention, 0.97);
    assert.equal(clampSettings({ theme: "neon" }).theme, "system");
    assert.equal(clampSettings({ theme: "dark" }).theme, "dark");
  });
});

test("daily new-card budget", async (t) => {
  await t.test("the first rating of a new card records introducedAt", () => {
    const card = makeCard("a");
    assert.equal(card.introducedAt, undefined);
    rateCard(card, Rating.Good);
    assert.ok(card.introducedAt);
  });

  await t.test("newPerDay=0 keeps new cards out of the due list", () => {
    const cards = [makeCard("a"), makeCard("b")];
    const settings = { ...DEFAULT_SETTINGS, newPerDay: 0 };
    assert.equal(getDueCards(cards, 20, settings).length, 0);
    assert.equal(cardStats(cards, settings).due, 0);
  });

  await t.test("cards introduced today count against the budget", () => {
    const a = makeCard("a");
    const b = makeCard("b");
    rateCard(a, Rating.Easy);
    assert.equal(getDueCards([a, b], 20, { ...DEFAULT_SETTINGS, newPerDay: 1 }).length, 0);
    const due = getDueCards([a, b], 20, { ...DEFAULT_SETTINGS, newPerDay: 2 });
    assert.deepEqual(due.map((c) => c.word), ["b"]);
  });
});

test("listCards", async (t) => {
  await t.test("summarizes cards, soonest due first with new cards on top", () => {
    const fresh = makeCard("fresh");
    const reviewed = makeCard("reviewed");
    rateCard(reviewed, Rating.Easy);
    const list = listCards([reviewed, fresh]);
    assert.equal(list.length, 2);
    assert.equal(list[0].word, "fresh");
    assert.equal(list[0].state, 0);
    assert.equal(list[1].word, "reviewed");
    assert.equal(list[1].state, 2);
    assert.equal(list[1].reps, 1);
    assert.equal(typeof list[1].due, "string");
  });

  await t.test("includes lapses and notes", () => {
    const card = makeCard("hard-word", "a tricky one");
    rateCard(card, Rating.Again);
    rateCard(card, Rating.Again);
    const [summary] = listCards([card]);
    assert.equal(summary.note, "a tricky one");
    assert.ok(summary.lapses > 0);
  });
});

test("mergeCards", async (t) => {
  await t.test("memory version wins for cards present in both", () => {
    const memory = makeCard("a");
    rateCard(memory, Rating.Good);
    const disk = { ...memory, note: "stale note" };
    const merged = mergeCards([disk], [memory]);
    assert.equal(merged.length, 1);
    assert.equal(merged[0].note, "a note");
    assert.equal(merged[0].fsrs.reps, 1);
  });

  await t.test("keeps disk-only cards (captured while a review window was open)", () => {
    const memory = makeCard("a");
    const diskOnly = makeCard("b");
    const merged = mergeCards([memory, diskOnly], [memory]);
    assert.deepEqual(merged.map((c) => c.word), ["a", "b"]);
  });

  await t.test("keeps memory-only cards", () => {
    const memory = makeCard("a");
    const merged = mergeCards([], [memory]);
    assert.equal(merged.length, 1);
  });
});
