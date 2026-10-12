/** Maps an OpenStreetMap class/type (from Nominatim) to the six categories the app shows. */
export type Category = "food" | "nature" | "culture" | "shopping" | "stay" | "other";

export const CATEGORY_LABEL: Record<Category, string> = {
  food: "Food",
  nature: "Nature",
  culture: "Culture",
  shopping: "Shopping",
  stay: "Stays",
  other: "Other",
};

const FOOD = ["restaurant", "cafe", "fast_food", "food_court", "bar", "pub", "ice_cream", "bakery", "marketplace", "biergarten"];
const CULTURE = ["museum", "attraction", "artwork", "gallery", "theatre", "place_of_worship", "castle", "monument", "memorial", "ruins", "shrine", "temple", "arts_centre", "viewpoint", "zoo", "aquarium", "theme_park"];
const NATURE = ["park", "garden", "beach", "peak", "nature_reserve", "water", "wood", "cliff", "waterfall", "forest", "bay"];
const SHOPPING = ["mall", "department_store", "supermarket", "clothes", "gift", "shop", "convenience"];
const STAY = ["hotel", "hostel", "guest_house", "motel", "apartment", "camp_site"];

export function categorise(osmClass?: string | null, osmType?: string | null): Category {
  const c = (osmClass ?? "").toLowerCase();
  const t = (osmType ?? "").toLowerCase();
  if (FOOD.includes(t)) return "food";
  if (STAY.includes(t)) return "stay";
  if (CULTURE.includes(t) || c === "historic" || c === "tourism") return "culture";
  if (NATURE.includes(t) || c === "natural" || c === "leisure") return "nature";
  if (c === "shop" || SHOPPING.includes(t)) return "shopping";
  if (c === "amenity" && FOOD.includes(t)) return "food";
  return "other";
}

/** Guess a category from a free-text expense label, e.g. "Lunch" → food. */
export function categoriseLabel(label?: string | null): Category {
  const l = (label ?? "").toLowerCase();
  if (/(lunch|dinner|breakfast|food|meal|coffee|cafe|drink|snack|ramen|market)/.test(l)) return "food";
  // transport before stays: "Grab to hotel" is a ride, not a room
  if (/(taxi|train|bus|grab|flight|metro|transport|fuel|parking)/.test(l)) return "other";
  if (/(hotel|hostel|stay|room|airbnb)/.test(l)) return "stay";
  if (/(shop|souvenir|gift|clothes|buy)/.test(l)) return "shopping";
  if (/(museum|entry|admission|temple|tour)/.test(l)) return "culture";
  return "other";
}
