import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { sortSeasons } from "./seasons";

export type Product = Tables<"products">;
export type Review = Tables<"reviews">;

export type DecisionStatus = "green" | "yellow" | "red";
export type SubmissionStatus = "draft" | "submitted";

export interface ReviewItem {
  product: Product;
  review: Review | null;
}

export async function fetchProducts(season?: string): Promise<Product[]> {
  let query = supabase
    .from("products")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("style_number", { ascending: true });
  if (season) query = query.eq("season", season);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function fetchSeasons(): Promise<string[]> {
  const { data, error } = await supabase.from("products").select("season");
  if (error) throw error;
  return sortSeasons((data ?? []).map((row) => row.season ?? "").filter(Boolean));
}

export async function fetchLatestSeason(): Promise<string | null> {
  const seasons = await fetchSeasons();
  return seasons[0] ?? null;
}

export async function fetchReviewsFor(reviewer: string, store: string): Promise<Review[]> {
  const { data, error } = await supabase
    .from("reviews")
    .select("*")
    .eq("reviewer", reviewer)
    .eq("store", store);
  if (error) throw error;
  return data ?? [];
}

export async function fetchAll(reviewer: string, store: string, season?: string): Promise<ReviewItem[]> {
  const activeSeason = season ?? await fetchLatestSeason();
  const [products, reviews] = await Promise.all([
    fetchProducts(activeSeason ?? undefined),
    fetchReviewsFor(reviewer, store),
  ]);
  const map = new Map(reviews.map((r) => [r.product_id, r]));
  return products.map((product) => ({ product, review: map.get(product.id) ?? null }));
}

export async function upsertReview(input: {
  product_id: string;
  reviewer: string;
  store: string;
  decision_status?: DecisionStatus | null;
  requested_bulk_units?: number | null;
  notes?: string | null;
  selected_sizes?: number[] | null;
  special_order_notes?: string | null;
}) {
  const { data, error } = await supabase
    .from("reviews")
    .upsert(
      {
        product_id: input.product_id,
        reviewer: input.reviewer,
        store: input.store,
        decision_status: input.decision_status ?? null,
        requested_bulk_units: input.requested_bulk_units ?? null,
        notes: input.notes ?? null,
        selected_sizes: input.selected_sizes ?? [],
        special_order_notes: input.special_order_notes ?? null,
      },
      { onConflict: "product_id,reviewer,store" }
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function submitAll(reviewer: string, store: string, productIds: string[]) {
  if (productIds.length === 0) return;
  const { error } = await supabase
    .from("reviews")
    .update({ submission_status: "submitted", submitted_at: new Date().toISOString() })
    .eq("reviewer", reviewer)
    .eq("store", store)
    .in("product_id", productIds)
    .eq("submission_status", "draft");
  if (error) throw error;
}
