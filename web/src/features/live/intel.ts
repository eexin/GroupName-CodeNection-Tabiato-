import "server-only";
import { cleanNews } from "@/features/live/news-filter";

/**
 * Trip intel from two sources:
 *  - UK FCDO foreign travel advice via the GOV.UK Content API — official, free, no key.
 *    Open Government Licence v3.0: attribution is shown on the page. Written for British
 *    nationals, which the page states.
 *  - NewsData.io latest news — free plan, 200 credits a day, commercial use allowed, about a
 *    12-hour delay. Headlines and links only; we never copy article text.
 */

export type Advice = { title: string; updated: string | null; change: string | null; url: string; sections: { title: string; text: string }[] };
export type Headline = { title: string; link: string; source: string; published: string | null };

const strip = (html: string) =>
  html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&").replace(/&#39;|&rsquo;/g, "'").replace(/&quot;|&ldquo;|&rdquo;/g, '"').replace(/\s+/g, " ").trim();

const slug = (country: string) => country.toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-");

async function fcdoDoc(path: string) {
  const res = await fetch(`https://www.gov.uk/api/content${path}`, { next: { revalidate: 21600 }, headers: { Accept: "application/json" } });
  return res.ok ? res.json() : null;
}

const WANTED = ["warnings-and-insurance", "entry-requirements", "safety-and-security", "health"];

export async function travelAdvice(countryName: string): Promise<Advice | null> {
  try {
    let doc = await fcdoDoc(`/foreign-travel-advice/${slug(countryName)}`);
    if (!doc) {
      // slug guess failed — look the country up in the index
      const index = await fcdoDoc("/foreign-travel-advice");
      const child = (index?.links?.children ?? []).find((c: { title?: string; details?: { country?: { name?: string } } }) =>
        [c.title, c.details?.country?.name].some((n) => n && n.toLowerCase() === countryName.toLowerCase()));
      if (child?.base_path) doc = await fcdoDoc(child.base_path);
    }
    if (!doc) return null;
    const parts: { title?: string; slug?: string; body?: string | { content_type?: string; content?: string }[] }[] = doc.details?.parts ?? [];
    const sections = parts
      .filter((p) => p.slug && WANTED.includes(p.slug))
      .sort((a, b) => WANTED.indexOf(a.slug!) - WANTED.indexOf(b.slug!))
      .map((p) => {
        const body = Array.isArray(p.body) ? (p.body.find((b) => b.content_type === "text/html")?.content ?? p.body[0]?.content ?? "") : p.body ?? "";
        const text = strip(body);
        return { title: p.title ?? p.slug!, text: text.length > 700 ? `${text.slice(0, 700).replace(/\s\S*$/, "")}…` : text };
      })
      .filter((s) => s.text);
    return {
      title: doc.title ?? countryName,
      updated: doc.public_updated_at ?? null,
      change: doc.details?.change_description ?? null,
      url: `https://www.gov.uk${doc.base_path ?? `/foreign-travel-advice/${slug(countryName)}`}`,
      sections,
    };
  } catch {
    return null;
  }
}

/**
 * Recent news that could matter to a traveller. Two searches, both cached for 3 hours (so at most
 * 16 credits a day per country, well inside 200): NewsData's own tourism section for the country,
 * and headlines that name the country together with a travel word. Press releases and repeats are
 * removed here; the intel page then has Ato keep only what could change the trip.
 */
export async function travelNews(countryCode: string, countryName: string): Promise<Headline[]> {
  const key = process.env.NEWSDATA_API_KEY;
  if (!key || !countryCode) return [];
  const base = `https://newsdata.io/api/1/latest?apikey=${key}&country=${countryCode.toLowerCase()}&language=en&size=10`;
  // kept short: the free plan limits how long a search can be
  const words = "(travel OR tourism OR tourists OR visa OR airport OR flights)";
  const urls = [
    `${base}&category=tourism`,
    `${base}&q=${encodeURIComponent(`"${countryName}" AND ${words}`)}`,
  ];
  const lists = await Promise.all(urls.map(async (url) => {
    try {
      const res = await fetch(url, { next: { revalidate: 10800 } }); // 3 h cache
      if (!res.ok) return [];
      const j = await res.json();
      return (j.results ?? []).map((r: { title: string; link: string; source_name?: string; source_id?: string; pubDate?: string }) => ({
        title: r.title, link: r.link, source: r.source_name ?? r.source_id ?? "", published: r.pubDate ?? null,
      })) as Headline[];
    } catch {
      return [];
    }
  }));
  return cleanNews(lists.flat());
}
