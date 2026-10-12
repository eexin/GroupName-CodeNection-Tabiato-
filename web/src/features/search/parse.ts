import type { Category } from "@/lib/categories";

/** A plain-language question turned into filters. Pure and unit-tested — no model guesses intent. */
export type SearchQuery = {
  text: string | null;
  minRating: number | null;
  category: Category | null;
  withPerson: string | null;
  inTrip: string | null;
  timeOfDay: "morning" | "afternoon" | "evening" | null;
  sort: "rating" | "spend" | null;
};

const CATEGORY_WORDS: [RegExp, Category][] = [
  [/\b(food|eat|ate|eating|restaurants?|cafes?|meals?|dinners?|lunch(?:es)?|breakfasts?)\b/, "food"],
  [/\b(nature|outdoors?|hikes?|hiking|parks?|beach(?:es)?|gardens?|mountains?|views?)\b/, "nature"],
  [/\b(culture|museums?|temples?|shrines?|palaces?|history|historic)\b/, "culture"],
  [/\b(shop(?:ping)?|malls?|markets?|souvenirs?)\b/, "shopping"],
];
// specific things people name that are also worth matching in place names and notes
const SPECIFIC = /\b(ramen|sushi|noodles?|coffee|seafood|beach|temple|shrine|market|museum|garden|tower|crossing|cliff|bay)\b/;
const STOP = new Set(["everything", "where", "did", "i", "the", "a", "an", "of", "to", "my", "me", "was", "were", "what", "which", "show", "find",
  "everything", "all", "places", "place", "go", "went", "visit", "visited", "on", "at", "for", "best", "most", "spend", "spent",
  "rated", "rate", "stars", "star", "with", "in", "and", "that", "it", "is", "eat", "ate"]);

export function parseQuery(q: string, ctx: { people: string[]; trips: string[] }): SearchQuery {
  let s = ` ${q.toLowerCase().replace(/[?!.,]/g, " ")} `;
  const out: SearchQuery = { text: null, minRating: null, category: null, withPerson: null, inTrip: null, timeOfDay: null, sort: null };

  const star = s.match(/\b([1-5])\s*(?:★|-?\s*stars?)\b|\brated\s+([1-5])\b|\b(five|four)[\s-]*stars?\b/);
  if (star) out.minRating = Number(star[1] ?? star[2] ?? (star[3] === "five" ? 5 : 4));
  if (/\b(spent|spend|spending|expensive|cost)\b/.test(s)) out.sort = "spend";
  else if (/\b(best|favou?rite|top)\b/.test(s)) out.sort = "rating";

  for (const [re, c] of CATEGORY_WORDS) if (re.test(s)) { out.category = c; break; }
  if (/\b(morning|mornings|breakfast|early)\b/.test(s)) out.timeOfDay = "morning";
  else if (/\b(afternoon)\b/.test(s)) out.timeOfDay = "afternoon";
  else if (/\b(evening|night|sunset|dinner)\b/.test(s)) out.timeOfDay = "evening";

  const withM = s.match(/\bwith\s+([a-z]+)/);
  if (withM) out.withPerson = ctx.people.find((p) => p.toLowerCase().split(" ")[0] === withM[1]) ?? null;
  const inM = s.match(/\bin\s+([a-z][a-z\s]{1,30}?)(?=\s(?:with|on|at|for|$)|\s*$)/);
  if (inM) out.inTrip = ctx.trips.find((t) => t.toLowerCase().includes(inM[1].trim())) ?? null;

  const spec = s.match(SPECIFIC);
  if (spec) out.text = spec[1];
  else {
    if (out.withPerson) s = s.replace(/\bwith\s+[a-z]+/, " ");
    if (out.inTrip) s = s.replace(/\bin\s+[a-z\s]+/, " ");
    const rest = s.split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w) && !/^\d/.test(w)
      && !CATEGORY_WORDS.some(([re]) => re.test(` ${w} `)) && !/^(morning|mornings|afternoon|evening|night|early|sunset)$/.test(w));
    if (rest.length) out.text = rest.join(" ");
  }
  return out;
}
