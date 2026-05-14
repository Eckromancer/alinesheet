import { useState } from "react";
import { useNavigate } from "react-router-dom";
import AppShell from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";

const SAMPLE = `[
  {
    "style_number": "AK-9001",
    "long_style_desc": "Example Wool Coat",
    "color": "Camel",
    "retail_price": 3490,
    "image_url": ""
  }
]`;

const HEADERS = ["style_number", "long_style_desc", "color", "retail_price", "image_url"];

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const split = (line: string) => {
    const out: string[] = []; let cur = ""; let q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (q) {
        if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (c === '"') q = false;
        else cur += c;
      } else {
        if (c === ",") { out.push(cur); cur = ""; }
        else if (c === '"') q = true;
        else cur += c;
      }
    }
    out.push(cur);
    return out;
  };
  const headers = split(lines[0]).map((h) => h.trim());
  return lines.slice(1).filter(Boolean).map((line) => {
    const cells = split(line);
    return Object.fromEntries(headers.map((h, i) => [h, (cells[i] ?? "").trim()]));
  });
}

export default function Admin() {
  const navigate = useNavigate();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const importNow = async () => {
    setBusy(true);
    try {
      let rows: any[] = [];
      const trimmed = text.trim();
      if (!trimmed) throw new Error("Paste CSV or JSON first.");
      if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
        const j = JSON.parse(trimmed);
        rows = Array.isArray(j) ? j : [j];
      } else {
        rows = parseCSV(trimmed);
      }
      const products = rows
        .map((r, i) => ({
          style_number: String(r.style_number ?? r["Style #"] ?? "").trim(),
          long_style_desc: String(r.long_style_desc ?? r["Long Style Desc"] ?? "").trim(),
          color: String(r.color ?? r["Color"] ?? "").trim(),
          retail_price: r.retail_price ?? r["Retail"] ?? null,
          image_url: r.image_url ?? r["Image"] ?? null,
          sort_order: i + 1,
        }))
        .filter((p) => p.style_number && p.long_style_desc && p.color)
        .map((p) => ({
          ...p,
          retail_price: p.retail_price === "" || p.retail_price == null ? null : Number(String(p.retail_price).replace(/[^0-9.]/g, "")),
          image_url: p.image_url ? String(p.image_url) : null,
        }));
      if (!products.length) throw new Error("No valid rows found. Required: style_number, long_style_desc, color.");
      const { error } = await supabase.from("products").insert(products);
      if (error) throw error;
      toast.success(`Imported ${products.length} product(s).`);
      setText("");
    } catch (e: any) {
      toast.error(e.message ?? "Import failed");
    } finally {
      setBusy(false);
    }
  };

  const clearAll = async () => {
    if (!confirm("Delete ALL products and reviews? This cannot be undone.")) return;
    setBusy(true);
    const { error } = await supabase.from("products").delete().not("id", "is", null);
    setBusy(false);
    if (error) toast.error(error.message);
    else toast.success("All products cleared.");
  };

  return (
    <AppShell
      subtitle="Admin · Worksheet Import"
      right={
        <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Back
        </Button>
      }
    >
      <div className="mx-auto max-w-2xl">
        <h1 className="font-display text-3xl font-medium">Import worksheet</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Paste CSV or JSON to load styles into the review queue. Required columns:{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{HEADERS.slice(0, 3).join(", ")}</code>.
          Optional: <code className="rounded bg-muted px-1.5 py-0.5 text-xs">retail_price, image_url</code>.
        </p>

        <div className="mt-5 space-y-3 rounded-2xl border border-border bg-card p-5 shadow-card">
          <Label htmlFor="data" className="text-xs uppercase tracking-widest text-muted-foreground">CSV or JSON</Label>
          <Textarea
            id="data"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={14}
            placeholder={`style_number,long_style_desc,color,retail_price,image_url\nAK-9001,Wool Coat,Camel,3490,\n\n— or —\n\n${SAMPLE}`}
            className="font-mono text-xs"
          />
          <div className="flex gap-2">
            <Button onClick={importNow} disabled={busy} size="lg" className="flex-1">
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Import
            </Button>
            <Button onClick={clearAll} disabled={busy} variant="outline" size="lg">
              Clear all
            </Button>
          </div>
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          Tip: the worksheet's headers (Image, Style #, Long Style Desc, Color, Retail) are recognized automatically.
        </p>
      </div>
    </AppShell>
  );
}
