/** Row shapes for the tables in supabase/schema.sql. Keep in sync with the schema. */

export type TripStatus = "planned" | "ongoing" | "finished";
export type LocationSource = "exif" | "device" | "manual" | "none";

export type Profile = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  travel_style: TravelStyle;
  onboarded_at: string | null;
  username: string | null;
  settings: Settings | null;
};

/** Figma 24 MEMORY switches. Missing keys mean "on". */
export type Settings = {
  auto_pin?: boolean; friends_can_add?: boolean; ato_insights?: boolean; map_theme?: "water" | "forest" | "night";
  /** The last uploaded photo, kept so "Use my photo" works after switching to the character. */
  photo_url?: string;
  /** The saved character look code (lib/character), kept while the photo is showing. */
  look?: string;
};
export const settingOn = (s: Settings | null | undefined, k: keyof Settings) => s?.[k] !== false;

export type TravelStyle = {
  budget?: "budget" | "mid" | "luxury";
  interests?: string[];
  pace?: "slow" | "balanced" | "packed";
  /** What Ato learned from your finished trips (features/planner/style.ts); written by the app, never typed in. */
  learned?: unknown;
};

export type Trip = {
  id: string;
  owner_id: string;
  name: string;
  destination: string | null;
  start_date: string | null;
  end_date: string | null;
  status: TripStatus;
  is_public: boolean;
  dest_lat: number | null;
  dest_lng: number | null;
  country_code: string | null;
  demo_alert: Hazard | null;
  share_settings: { photos?: boolean; ratings?: boolean; comments?: boolean; spend?: boolean } | null;
  cover_path: string | null;
  created_at: string;
};

export type Member = {
  trip_id: string;
  user_id: string;
  role: "owner" | "contributor" | "viewer";
  status: "invited" | "joined";
  invited_by: string | null;
};

export type Place = {
  id: string;
  trip_id: string;
  name: string;
  category: string | null;
  lat: number;
  lng: number;
  first_seen_at: string | null;
  last_seen_at: string | null;
};

export type Photo = {
  id: string;
  trip_id: string;
  place_id: string | null;
  uploaded_by: string;
  storage_path: string;
  taken_at: string | null;
  lat: number | null;
  lng: number | null;
  location_source: LocationSource;
  width: number | null;
  height: number | null;
  created_at: string;
};

export type Expense = {
  id: string;
  trip_id: string;
  place_id: string | null;
  paid_by: string;
  amount: number;
  currency: string;
  amount_myr: number | null;
  label: string | null;
  split_count: number;
  created_at: string;
};

export type Rating = { place_id: string; trip_id: string; user_id: string; stars: number };
export type Note = { place_id: string; trip_id: string; user_id: string; body: string; ai_drafted: boolean };
export type Comment = { id: string; place_id: string; trip_id: string; user_id: string; body: string; created_at: string };

export type ActionResult = { error?: string; ok?: boolean };

/** A natural-hazard event near a trip (GDACS), or a clearly labelled demo one. */
export type Hazard = {
  id: string; type: string; name: string; level: string; country: string; from: string; to: string | null;
  lat: number; lng: number; km: number; url: string | null; demo?: boolean;
};
