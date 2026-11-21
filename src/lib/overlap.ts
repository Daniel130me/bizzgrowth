// How much two pieces of text are about the same thing, by the meaningful
// words they share. Pure (no browser, no store): used by the insights route to
// catch an insight that restates a tracked challenge, and by the page to offer
// "keep it with that one" instead of tracking the same problem twice.

// Words that say nothing about which problem it is (and plain English glue).
const STOP = new Set(
  "the and for with your you our they them their this that these those are was were been being has have had not but too very many much more most some any few each every all can could would should will may might just only also than then there here when what which who how why into from about over under out off its dont cant wont didnt doesnt isnt arent wasnt werent havent hasnt already still even really before after again other same without likely need make made get got keep help people person business customer client owner one two three day week month time thing way new lot".split(" "),
);
const stem = (w: string) => w.replace(/(ness|ing|ed|s)$/, "");

/** The meaningful words of a text, lightly stemmed ("weekdays" → "weekday", "quietness" → "quiet"). */
export function contentWords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[’']/g, "")
      .replace(/[^a-z]+/g, " ")
      .split(" ")
      .map((w) => (w.length > 4 ? stem(w) : w))
      .filter((w) => w.length > 2 && !STOP.has(w)),
  );
}

/** How many meaningful words `a` and `b` share. */
export function sharedWords(a: string, b: string): number {
  const said = contentWords(a);
  let n = 0;
  for (const w of contentWords(b)) if (said.has(w)) n++;
  return n;
}

/** Two or more shared meaningful words: the same subject, whatever the wording. */
export const SAME_SUBJECT = 2;
