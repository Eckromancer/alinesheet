import type { ReviewItem } from "./reviews";

export function formatPrice(n: number | null | undefined) {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(n));
}

export function rowsForExport(items: ReviewItem[], reviewer: string, store: string) {
  return items.map(({ product, review }) => ({
    style_number: product.style_number,
    long_style_desc: product.long_style_desc,
    color: product.color,
    retail_price: product.retail_price ?? "",
    image_url: product.image_url ?? "",
    decision_status: review?.decision_status ?? "",
    requested_bulk_units: review?.requested_bulk_units ?? "",
    selected_sizes: review?.selected_sizes?.join(" ") ?? "",
    size_count: review?.selected_sizes?.length ?? 0,
    notes: review?.notes ?? "",
    special_order_notes: review?.special_order_notes ?? "",
    reviewer,
    store,
    submitted_at: review?.submitted_at ?? "",
  }));
}

export function toCSV(rows: Record<string, unknown>[]) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(","), ...rows.map((r) => headers.map((h) => esc(r[h])).join(","))].join("\n");
}

export function downloadFile(content: string, filename: string, mime = "text/csv;charset=utf-8") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
