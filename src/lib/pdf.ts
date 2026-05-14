import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { ReviewItem } from "./reviews";
import { formatPrice } from "./exporting";

async function loadImage(url: string): Promise<{ data: string; w: number; h: number } | null> {
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) return null;
    const blob = await res.blob();
    const dataUrl: string = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onloadend = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
    const dims: { w: number; h: number } = await new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = () => resolve({ w: 1, h: 1 });
      img.src = dataUrl;
    });
    return { data: dataUrl, w: dims.w, h: dims.h };
  } catch {
    return null;
  }
}

export async function generateWorksheetPDF(
  items: ReviewItem[],
  reviewer: string,
  store: string,
  onProgress?: (done: number, total: number) => void,
) {
  const doc = new jsPDF({ unit: "pt", format: "letter", orientation: "landscape" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  // Cover header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Style Compass · Buying Worksheet", 40, 40);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Store: ${store}`, 40, 58);
  doc.text(`DSA: ${reviewer}`, 40, 72);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 40, 86);
  doc.text(`Items: ${items.length}`, 40, 100);

  // Pre-load images sequentially with progress
  const images: (Awaited<ReturnType<typeof loadImage>>)[] = [];
  for (let i = 0; i < items.length; i++) {
    const url = items[i].product.image_url;
    images.push(url ? await loadImage(url) : null);
    onProgress?.(i + 1, items.length);
  }

  const rowH = 70;
  const imgCellW = 70;

  const body = items.map((it, idx) => {
    const p = it.product;
    const r = it.review;
    return [
      String(idx + 1),
      "", // image cell, drawn manually
      p.style_number,
      p.long_style_desc,
      p.color,
      formatPrice(p.retail_price),
      (r?.decision_status ?? "").toUpperCase(),
      r?.selected_sizes?.length ? r.selected_sizes.join(", ") : "",
      r?.requested_bulk_units != null ? String(r.requested_bulk_units) : "",
      [r?.notes, r?.special_order_notes].filter(Boolean).join(" — "),
    ];
  });

  autoTable(doc, {
    startY: 120,
    head: [[
      "#", "Image", "Style", "Description", "Color", "Retail",
      "Decision", "Sizes", "Units", "Comments",
    ]],
    body,
    styles: { fontSize: 8, cellPadding: 4, valign: "middle", minCellHeight: rowH },
    headStyles: { fillColor: [20, 20, 20], textColor: 255, fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: 24, halign: "center" },
      1: { cellWidth: imgCellW, halign: "center" },
      2: { cellWidth: 60 },
      3: { cellWidth: 160 },
      4: { cellWidth: 70 },
      5: { cellWidth: 50, halign: "right" },
      6: { cellWidth: 55, halign: "center", fontStyle: "bold" },
      7: { cellWidth: 70 },
      8: { cellWidth: 40, halign: "center" },
      9: { cellWidth: "auto" },
    },
    margin: { left: 24, right: 24, top: 40, bottom: 30 },
    didDrawCell: (data) => {
      if (data.section === "body" && data.column.index === 1) {
        const img = images[data.row.index];
        if (img) {
          const maxW = data.cell.width - 6;
          const maxH = data.cell.height - 6;
          const ratio = Math.min(maxW / img.w, maxH / img.h);
          const w = img.w * ratio;
          const h = img.h * ratio;
          const x = data.cell.x + (data.cell.width - w) / 2;
          const y = data.cell.y + (data.cell.height - h) / 2;
          try {
            doc.addImage(img.data, "JPEG", x, y, w, h, undefined, "FAST");
          } catch {
            try { doc.addImage(img.data, "PNG", x, y, w, h, undefined, "FAST"); } catch { /* ignore */ }
          }
        }
      }
    },
    didDrawPage: () => {
      const str = `Style Compass Worksheet · ${store} · ${reviewer}`;
      doc.setFontSize(8);
      doc.setTextColor(120);
      doc.text(str, 24, pageH - 14);
      doc.text(`Page ${doc.getNumberOfPages()}`, pageW - 24, pageH - 14, { align: "right" });
      doc.setTextColor(0);
    },
  });

  const filename = `worksheet-${store.replace(/\s+/g, "_")}-${reviewer.replace(/\s+/g, "_")}-${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
}
