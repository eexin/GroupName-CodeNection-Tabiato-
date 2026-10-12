import type { Category } from "@/lib/categories";

export type BookPage = {
  place_id: string;
  day: string;
  heading: string;
  body: string;
  photo_path: string | null;
  rating: number | null;
  category: Category;
};

export type BookContent = {
  title: string;
  subtitle: string;
  pages: BookPage[];
  observations: string[];
  closing: string;
  totals: { photos: number; places: number; spend: number; days: number };
  spendByCategory: { label: string; amount: number; share: number }[];
  travelType: string;
  source: "ai" | "template";
};
