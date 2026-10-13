/**
 * Your character — a dress-up avatar (Profile → Dress up, /profile/avatar). Ported from the SEA avatar: a base
 * person drawn as SVG with one item per slot layered on top. Redrawn in Tabiato's colours, with
 * Ato's eyes, a choice of skin tone and hair colour, and travel items. Everything is free.
 *
 * A look is stored as a short code ("s2.c1.hair_long.hat_straw") inside the profile's avatar
 * URL (/api/avatar/<code>), so every place that already shows a profile photo shows the
 * character too. Someone with no photo and no saved look gets lookFromSeed(their id). Lives in
 * lib because people.ts needs it. Pure and unit-tested; only known keys are ever drawn.
 */

export const SKINS = ["#F6D7C3", "#EDBB96", "#D9A679", "#B9825A", "#8D5A3B", "#5E3A26"] as const;
export const HAIR_COLORS = ["#2B2321", "#4A3423", "#7A4E2D", "#A5532E", "#D9B26B", "#A3ABAF"] as const;
export const SKIN_NAMES = ["Fair", "Light", "Medium", "Tan", "Brown", "Deep"] as const;
export const HAIR_COLOR_NAMES = ["Black", "Dark brown", "Brown", "Auburn", "Blonde", "Silver"] as const;

const INK = "#12312F";
const BLUSH = "#F58A6B";
const BG = "#BFE4E0";

/** The editor's tabs, in order. Drawing order is set in renderLook. */
export const SLOTS = ["hair", "hat", "glasses", "ear", "clothes", "neck", "back", "frame"] as const;
export type Slot = (typeof SLOTS)[number];

export const SLOT_LABEL: Record<Slot, string> = {
  hair: "Hair", hat: "Hats", glasses: "Glasses", ear: "Earrings", clothes: "Tops", neck: "Neck", back: "Bags", frame: "Frame",
};

type Item = { slot: Slot; name: string; draw: (hair: string) => string; behind?: (hair: string) => string };

const torso = (fill: string) => `<path d='M52 240 V198 Q52 152 100 150 Q148 152 148 198 V240 Z' fill='${fill}'/>`;

/** Every item, keyed by the code stored in the look. Names are what the editor shows. */
export const ITEMS: Record<string, Item> = {
  // ----- hair (colour comes from the look) -----
  hair_short: { slot: "hair", name: "Short", draw: (h) => `<path d='M56 76 Q52 30 100 30 Q148 30 144 76 Q142 58 126 49 Q112 42 100 43 Q88 42 74 49 Q58 58 56 76 Z' fill='${h}'/>` },
  hair_long: {
    slot: "hair", name: "Long",
    behind: (h) => `<path d='M58 80 Q54 140 66 154 L134 154 Q146 140 142 80 Z' fill='${h}'/>`,
    draw: (h) => `<path d='M54 74 Q50 26 100 26 Q150 26 146 74 Q138 50 118 46 Q100 56 74 50 Q60 58 54 74 Z' fill='${h}'/>`,
  },
  hair_curly: {
    slot: "hair", name: "Curly",
    draw: (h) => [[66, 58, 16], [86, 44, 17], [108, 40, 17], [128, 50, 16], [140, 66, 13], [58, 72, 12]].map(([x, y, r]) => `<circle cx='${x}' cy='${y}' r='${r}' fill='${h}'/>`).join(""),
  },
  hair_bun: {
    slot: "hair", name: "Top bun",
    draw: (h) => `<circle cx='100' cy='26' r='16' fill='${h}'/><path d='M56 74 Q54 34 100 34 Q146 34 144 74 Q136 52 100 48 Q64 52 56 74 Z' fill='${h}'/>`,
  },
  hair_bob: {
    slot: "hair", name: "Bob",
    behind: (h) => `<path d='M56 78 Q52 118 60 124 L140 124 Q148 118 144 78 Z' fill='${h}'/>`,
    draw: (h) => `<path d='M54 80 Q50 28 100 28 Q150 28 146 80 Q140 56 120 52 L100 60 L80 52 Q60 56 54 80 Z' fill='${h}'/>`,
  },

  // ----- hats (over the hair) -----
  hat_cap: { slot: "hat", name: "Cap", draw: () => "<path d='M58 62 Q58 24 100 24 Q142 24 142 62 Z' fill='#E8623F'/><path d='M140 54 Q176 56 178 64 Q178 70 140 66 Z' fill='#B8402A'/><circle cx='100' cy='26' r='5' fill='#B8402A'/>" },
  hat_beanie: { slot: "hat", name: "Beanie", draw: () => "<path d='M58 66 Q58 22 100 22 Q142 22 142 66 Z' fill='#0E4C55'/><rect x='55' y='58' width='90' height='14' rx='7' fill='#0A3A42'/><circle cx='100' cy='20' r='7' fill='#7FC9C2'/>" },
  hat_straw: { slot: "hat", name: "Sun hat", draw: () => "<ellipse cx='100' cy='54' rx='70' ry='14' fill='#E9C77B'/><path d='M66 54 Q66 16 100 16 Q134 16 134 54 Z' fill='#F2D899'/><path d='M66 46 H134 V54 H66 Z' fill='#E8623F'/>" },
  hat_bucket: { slot: "hat", name: "Bucket hat", draw: () => "<path d='M50 62 Q56 50 64 50 L136 50 Q144 50 150 62 Z' fill='#5C7FA8'/><path d='M64 54 Q64 20 100 20 Q136 20 136 54 Z' fill='#7393BA'/>" },

  // ----- glasses -----
  glasses_round: { slot: "glasses", name: "Round", draw: () => `<g fill='none' stroke='${INK}' stroke-width='3' stroke-linecap='round'><circle cx='84' cy='76' r='12'/><circle cx='116' cy='76' r='12'/><path d='M96 76 h8 M72 73 L58 69 M128 73 L142 69'/></g>` },
  glasses_sun: { slot: "glasses", name: "Sunnies", draw: () => `<rect x='68' y='66' width='30' height='20' rx='9' fill='${INK}'/><rect x='102' y='66' width='30' height='20' rx='9' fill='${INK}'/><path d='M98 73 h4 M68 71 L57 67 M132 71 L143 67' stroke='${INK}' stroke-width='3.5' stroke-linecap='round'/><path d='M74 71 l8 0' stroke='#7FC9C2' stroke-width='3' stroke-linecap='round'/><path d='M108 71 l8 0' stroke='#7FC9C2' stroke-width='3' stroke-linecap='round'/>` },

  // ----- earrings -----
  ear_stud: { slot: "ear", name: "Studs", draw: () => "<circle cx='55' cy='88' r='3.5' fill='#E8A23F'/><circle cx='145' cy='88' r='3.5' fill='#E8A23F'/>" },
  ear_hoop: { slot: "ear", name: "Hoops", draw: () => "<g fill='none' stroke='#E8A23F' stroke-width='3'><circle cx='56' cy='96' r='6'/><circle cx='144' cy='96' r='6'/></g>" },

  // ----- tops (over the plain tee) -----
  clothes_tee: { slot: "clothes", name: "Tee", draw: () => torso("#0E4C55") + "<path d='M84 151 Q100 164 116 151 Q108 148 100 148 Q92 148 84 151 Z' fill='#0A3A42'/>" },
  clothes_hoodie: { slot: "clothes", name: "Hoodie", draw: () => torso("#E8623F") + "<path d='M64 178 Q100 202 136 178 Q136 156 100 151 Q64 156 64 178 Z' fill='#B8402A'/><path d='M90 176 v22 M110 176 v22' stroke='#FBE3DA' stroke-width='4' stroke-linecap='round'/>" },
  clothes_aloha: {
    slot: "clothes", name: "Aloha shirt",
    draw: () => torso("#7FC9C2") + "<path d='M86 151 L100 176 L114 151' fill='#F2EAD8'/>" +
      [[70, 196], [128, 188], [88, 222], [122, 226], [62, 226]].map(([x, y], i) => `<circle cx='${x}' cy='${y}' r='7' fill='${i % 2 ? "#E8623F" : "#E8A23F"}'/><circle cx='${x}' cy='${y}' r='2.5' fill='#F2EAD8'/>`).join(""),
  },
  clothes_rain: { slot: "clothes", name: "Rain jacket", draw: () => torso("#E8A23F") + "<path d='M62 168 Q100 186 138 168 Q136 152 100 149 Q64 152 62 168 Z' fill='#C9862E'/><path d='M100 172 V240' stroke='#86570F' stroke-width='3'/><circle cx='112' cy='196' r='2.5' fill='#86570F'/><circle cx='112' cy='214' r='2.5' fill='#86570F'/>" },

  // ----- neck -----
  neck_scarf: { slot: "neck", name: "Scarf", draw: () => "<path d='M74 148 Q100 166 126 148 L128 160 Q100 178 72 160 Z' fill='#E8623F'/><path d='M110 166 L118 204 L106 206 L102 170 Z' fill='#B8402A'/>" },
  neck_lei: { slot: "neck", name: "Flower lei", draw: () => [[70, 158], [80, 168], [92, 174], [104, 176], [116, 172], [127, 165], [134, 156]].map(([x, y], i) => `<circle cx='${x}' cy='${y}' r='7' fill='${["#F58A6B", "#E8A23F", "#F9AE8C", "#E8623F"][i % 4]}'/><circle cx='${x}' cy='${y}' r='2' fill='#FFF6E5'/>`).join("") },
  neck_camera: { slot: "neck", name: "Camera", draw: () => `<path d='M72 152 L100 196 L128 152' fill='none' stroke='${INK}' stroke-width='3'/><rect x='82' y='188' width='36' height='24' rx='5' fill='${INK}'/><rect x='88' y='184' width='10' height='6' rx='2' fill='${INK}'/><circle cx='100' cy='200' r='8' fill='#5C7FA8'/><circle cx='100' cy='200' r='4' fill='#BFE4E0'/>` },

  // ----- bags -----
  back_backpack: {
    slot: "back", name: "Backpack",
    behind: () => "<rect x='40' y='160' width='120' height='80' rx='22' fill='#0A3A42'/>",
    draw: () => "<path d='M66 158 Q70 200 72 240' stroke='#0A3A42' stroke-width='9' fill='none' stroke-linecap='round'/><path d='M134 158 Q130 200 128 240' stroke='#0A3A42' stroke-width='9' fill='none' stroke-linecap='round'/>",
  },

  // ----- frame -----
  frame_gold: { slot: "frame", name: "Gold ring", draw: () => "<circle cx='100' cy='78' r='54' fill='none' stroke='#E8A23F' stroke-width='4'/><circle cx='100' cy='78' r='54' fill='none' stroke='#FFF3C4' stroke-width='4' stroke-dasharray='4 22' stroke-linecap='round'/>" },
};

export type Look = { skin: number; hairColor: number; items: Partial<Record<Slot, string>> };

/** Short, URL-safe code: "s2.c1.hair_long.hat_straw". Unknown parts are ignored when read. */
export function encodeLook(look: Look): string {
  const parts = [`s${look.skin}`, `c${look.hairColor}`];
  for (const slot of SLOTS) { const k = look.items[slot]; if (k && ITEMS[k]?.slot === slot) parts.push(k); }
  return parts.join(".");
}

export function decodeLook(code: string | null | undefined): Look | null {
  if (!code) return null;
  const parts = code.split(".");
  const num = (p: string | undefined, prefix: string, max: number) => {
    const n = p?.startsWith(prefix) ? Number(p.slice(1)) : NaN;
    return Number.isInteger(n) && n >= 0 && n < max ? n : null;
  };
  const skin = num(parts[0], "s", SKINS.length);
  const hairColor = num(parts[1], "c", HAIR_COLORS.length);
  if (skin === null || hairColor === null) return null;
  const items: Look["items"] = {};
  for (const k of parts.slice(2)) if (ITEMS[k]) items[ITEMS[k].slot] = k; // one per slot; later wins
  return { skin, hairColor, items };
}

/** A character that looks like someone, picked from a user id so it never changes on its own. */
export function lookFromSeed(seed: string): Look {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619) >>> 0;
  const pick = <T,>(arr: readonly T[], shift: number) => arr[(h >>> shift) % arr.length];
  return {
    skin: (h >>> 1) % SKINS.length,
    hairColor: (h >>> 5) % HAIR_COLORS.length,
    items: {
      hair: pick(["hair_short", "hair_long", "hair_curly", "hair_bun", "hair_bob"], 9),
      clothes: pick(["clothes_tee", "clothes_hoodie", "clothes_aloha", "clothes_rain"], 13),
    },
  };
}

/** "Surprise me": every slot gets something or nothing, at random. */
export function randomLook(rand: () => number = Math.random): Look {
  const any = (slot: Slot, emptyChance: number) => {
    if (rand() < emptyChance) return undefined;
    const keys = Object.keys(ITEMS).filter((k) => ITEMS[k].slot === slot);
    return keys[Math.floor(rand() * keys.length)];
  };
  return {
    skin: Math.floor(rand() * SKINS.length),
    hairColor: Math.floor(rand() * HAIR_COLORS.length),
    items: {
      hair: any("hair", 0.1), clothes: any("clothes", 0), hat: any("hat", 0.5), glasses: any("glasses", 0.55),
      ear: any("ear", 0.6), neck: any("neck", 0.6), back: any("back", 0.6), frame: any("frame", 0.85),
    },
  };
}

/**
 * The SVG. "bust" is the head and shoulders on aqua (what profile photos are replaced with),
 * "chest" frames tops, neck items and bags, and "full" is the whole character for Dress up.
 */
export function renderLook(look: Look, view: "bust" | "chest" | "full" = "bust"): string {
  const skin = SKINS[look.skin] ?? SKINS[2];
  const hair = HAIR_COLORS[look.hairColor] ?? HAIR_COLORS[0];
  const shade = darken(skin, 0.18);
  const on = SLOTS.map((s) => look.items[s]).filter((k): k is string => Boolean(k && ITEMS[k]));
  const behind = on.map((k) => ITEMS[k].behind?.(hair) ?? "").join("");
  const body =
    `<rect x='86' y='108' width='28' height='48' rx='12' fill='${shade}'/>` +
    torso("#9DB8B4") +
    `<path d='M86 150 Q100 160 114 150 L114 142 H86 Z' fill='${shade}'/>`;
  const head =
    `<circle cx='56' cy='82' r='9' fill='${skin}'/><circle cx='144' cy='82' r='9' fill='${skin}'/>` +
    `<circle cx='100' cy='78' r='44' fill='${skin}'/>` +
    // Ato's eyes: white, dark pupil, a little shine
    `<circle cx='84' cy='76' r='8' fill='#fff'/><circle cx='116' cy='76' r='8' fill='#fff'/>` +
    `<circle cx='85' cy='77' r='5' fill='${INK}'/><circle cx='117' cy='77' r='5' fill='${INK}'/>` +
    `<circle cx='87' cy='75' r='1.8' fill='#fff'/><circle cx='119' cy='75' r='1.8' fill='#fff'/>` +
    `<ellipse cx='72' cy='92' rx='7' ry='4' fill='${BLUSH}' opacity='.35'/><ellipse cx='128' cy='92' rx='7' ry='4' fill='${BLUSH}' opacity='.35'/>` +
    `<path d='M90 96 Q100 104 110 96' fill='none' stroke='${INK}' stroke-width='3' stroke-linecap='round'/>`;
  // frame ring at the very back; clothes and bags under the head; hair and accessories on top
  const split = (slots: Slot[]) => on.filter((k) => slots.includes(ITEMS[k].slot)).map((k) => ITEMS[k].draw(hair)).join("");
  const content = split(["frame"]) + behind + body + split(["back", "clothes", "neck"]) + head + split(["hair", "ear", "glasses", "hat"]);
  // bust: head and shoulders (profile pictures); chest: chin to waist (trying on tops, neck, bags)
  const box = { bust: [22, 0, 156, 156], chest: [18, 70, 164, 164], full: [0, 0, 200, 240] }[view];
  const viewBox = box.join(" ");
  const bg = view === "full" ? `<circle cx='100' cy='120' r='96' fill='${BG}'/>` : `<rect x='${box[0]}' y='${box[1]}' width='${box[2]}' height='${box[3]}' fill='${BG}'/>`;
  return `<svg xmlns='http://www.w3.org/2000/svg' viewBox='${viewBox}' role='img' aria-label='Character'>${bg}${content}</svg>`;
}

function darken(hex: string, by: number) {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) => Math.round(v * (1 - by)).toString(16).padStart(2, "0");
  return `#${c(n >> 16)}${c((n >> 8) & 255)}${c(n & 255)}`;
}

/** The profile's avatar URL for a look. Only this app's own path, so it is safe in an <img>. */
export const lookUrl = (look: Look) => `/api/avatar/${encodeLook(look)}`;
export const lookFromUrl = (url: string | null | undefined) =>
  url?.startsWith("/api/avatar/") ? decodeLook(url.slice("/api/avatar/".length).split(/[?#]/)[0]) : null;
