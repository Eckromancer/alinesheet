import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Product = Tables<"products">;
export type Review = Tables<"reviews">;

export type DecisionStatus = "green" | "yellow" | "red";
export type SubmissionStatus = "draft" | "submitted";

export interface ReviewItem {
  product: Product;
  review: Review | null;
}

export async function fetchProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("style_number", { ascending: true });
  if (error) throw error;
  return data ?? [];
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

export async function fetchAll(reviewer: string, store: string): Promise<ReviewItem[]> {
  const [products, reviews] = await Promise.all([
    fetchProducts(),
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

export async function submitAll(reviewer: string, store: string) {
  const { error } = await supabase
    .from("reviews")
    .update({ submission_status: "submitted", submitted_at: new Date().toISOString() })
    .eq("reviewer", reviewer)
    .eq("store", store)
    .eq("submission_status", "draft");
  if (error) throw error;
}
