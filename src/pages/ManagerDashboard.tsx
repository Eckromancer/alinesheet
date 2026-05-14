import { useEffect, useMemo, useState } from "react";
import ManagerLayout from "@/components/ManagerLayout";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { STORES } from "@/lib/stores";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import ProductImage from "@/components/ProductImage";
import { Link } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  HeroRatio,
  AssortmentMatrix,
  DoorHeatmap,
  CategoryRatios,
  type DoorRow,
  type AggLite,
} from "@/components/dashboard/Infographics";

type Review = Tables<"reviews">;
type Product = Tables<"products">;

type Decision = "green" | "yellow" | "red";

interface SyntheticReview {
  product_id: string;
  store: string;
  decision_status: Decision;
  requested_bulk_units: number;
  client_backed: boolean;
  has_notes: boolean;
}

// ---------- deterministic mock augmentation ----------
function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}
function rand(seed: number): number {
  return ((seed * 2654435761) >>> 0) / 0x100000000;
}

// ---------- store + product profiling ----------
type StoreTier = "flagship" | "premium" | "core" | "small";
interface StoreProfile {
  tier: StoreTier;
  participation: number;
  depthMult: number;
  vicWeight: number;
  runwayAffinity: number;
  responseLag: number;
}

const STORE_PROFILES: Record<string, StoreProfile> = {
  "1019": { tier: "flagship", participation: 0.99, depthMult: 1.55, vicWeight: 0.32, runwayAffinity: 0.92, responseLag: 0.05 },
  "1011": { tier: "flagship", participation: 0.98, depthMult: 1.45, vicWeight: 0.30, runwayAffinity: 0.90, responseLag: 0.08 },
  "1012": { tier: "flagship", participation: 0.97, depthMult: 1.35, vicWeight: 0.28, runwayAffinity: 0.88, responseLag: 0.10 },
  "1005": { tier: "flagship", participation: 0.99, depthMult: 1.60, vicWeight: 0.38, runwayAffinity: 0.95, responseLag: 0.04 },
  "1010": { tier: "flagship", participation: 0.97, depthMult: 1.40, vicWeight: 0.30, runwayAffinity: 0.90, responseLag: 0.08 },
  "1002": { tier: "premium", participation: 0.93, depthMult: 1.20, vicWeight: 0.22, runwayAffinity: 0.72, responseLag: 0.15 },
  "1014": { tier: "premium", participation: 0.92, depthMult: 1.15, vicWeight: 0.20, runwayAffinity: 0.70, responseLag: 0.18 },
  "1020": { tier: "premium", participation: 0.92, depthMult: 1.10, vicWeight: 0.18, runwayAffinity: 0.68, responseLag: 0.18 },
  "1023": { tier: "premium", participation: 0.90, depthMult: 1.10, vicWeight: 0.18, runwayAffinity: 0.65, responseLag: 0.20 },
  "1025": { tier: "premium", participation: 0.91, depthMult: 1.15, vicWeight: 0.20, runwayAffinity: 0.68, responseLag: 0.18 },
  "1009": { tier: "premium", participation: 0.88, depthMult: 1.05, vicWeight: 0.16, runwayAffinity: 0.60, responseLag: 0.22 },
  "1004": { tier: "core", participation: 0.82, depthMult: 0.95, vicWeight: 0.12, runwayAffinity: 0.45, responseLag: 0.30 },
  "1006": { tier: "core", participation: 0.80, depthMult: 0.90, vicWeight: 0.11, runwayAffinity: 0.42, responseLag: 0.32 },
  "1030": { tier: "core", participation: 0.80, depthMult: 0.90, vicWeight: 0.10, runwayAffinity: 0.40, responseLag: 0.32 },
  "1034": { tier: "core", participation: 0.78, depthMult: 0.95, vicWeight: 0.13, runwayAffinity: 0.45, responseLag: 0.30 },
  "1038": { tier: "core", participation: 0.78, depthMult: 0.92, vicWeight: 0.12, runwayAffinity: 0.42, responseLag: 0.32 },
  "1027": { tier: "core", participation: 0.76, depthMult: 0.85, vicWeight: 0.09, runwayAffinity: 0.38, responseLag: 0.40 },
  "1102": { tier: "core", participation: 0.74, depthMult: 0.82, vicWeight: 0.08, runwayAffinity: 0.35, responseLag: 0.45 },
  "1001": { tier: "small", participation: 0.62, depthMult: 0.70, vicWeight: 0.06, runwayAffinity: 0.25, responseLag: 0.65 },
  "1003": { tier: "small", participation: 0.60, depthMult: 0.70, vicWeight: 0.05, runwayAffinity: 0.22, responseLag: 0.68 },
  "1016": { tier: "small", participation: 0.66, depthMult: 0.72, vicWeight: 0.07, runwayAffinity: 0.28, responseLag: 0.55 },
  "1029": { tier: "small", participation: 0.55, depthMult: 0.65, vicWeight: 0.05, runwayAffinity: 0.20, responseLag: 0.78 },
  "1033": { tier: "small", participation: 0.62, depthMult: 0.70, vicWeight: 0.06, runwayAffinity: 0.25, responseLag: 0.65 },
  "1036": { tier: "small", participation: 0.64, depthMult: 0.72, vicWeight: 0.07, runwayAffinity: 0.28, responseLag: 0.58 },
};

function profileFor(code: string): StoreProfile {
  return (
    STORE_PROFILES[code] ?? {
      tier: "core",
      participation: 0.75,
      depthMult: 0.85,
      vicWeight: 0.1,
      runwayAffinity: 0.4,
      responseLag: 0.4,
    }
  );
}

type Category = "knitwear" | "outerwear" | "leather" | "evening" | "dress" | "tailoring";
interface ProductProfile {
  category: Category;
  priceTier: "commercial" | "mid" | "runway";
  editorial: boolean;
  polarity: number;
  commercialAppeal: number;
}

function classifyProduct(p: Product): ProductProfile {
  const d = (p.long_style_desc || "").toLowerCase();
  const price = Number(p.retail_price || 0);

  const isLeather = /(nappa|leather|calfskin|lambskin|shearling|lamb )/.test(d);
  const isEvening = /(bustier|sequin|fringe|lurex|guipure|lace|georgette|crêpe|crepe|silk)/.test(d) && /(blouse|bustier|gown|fringe|sequin|lurex|guipure)/.test(d);
  const isKnit = /(knit|cashmere|cardigan|sweater)/.test(d) && !/jacket|coat|blazer/.test(d);
  const isOuter = /(jacket|coat|blazer|bomber|kimono)/.test(d);
  const isDress = /(dress|skirt)/.test(d);

  let category: Category;
  if (isLeather) category = "leather";
  else if (isEvening) category = "evening";
  else if (isKnit) category = "knitwear";
  else if (isOuter) category = "outerwear";
  else if (isDress) category = "dress";
  else category = "tailoring";

  const priceTier: ProductProfile["priceTier"] =
    price >= 4000 ? "runway" : price >= 2000 ? "mid" : "commercial";

  const editorialKeywords = /(degradé|degrade|appaloosa|intarsia|fringe|guipure|sequin|lurex|asymmetrical|deconstructed|reversible|plaid|tweed|bouclé|boucle|horsehair)/.test(d);
  const editorial = editorialKeywords || (priceTier === "runway" && (category === "leather" || category === "evening" || category === "outerwear"));

  const seed = hash(p.style_number);
  const basePol =
    category === "knitwear" ? 0.10 :
    category === "outerwear" ? (editorial ? 0.55 : 0.25) :
    category === "tailoring" ? 0.20 :
    category === "dress" ? (editorial ? 0.55 : 0.30) :
    category === "leather" ? 0.65 :
    0.75;
  const polarity = Math.min(0.95, basePol + rand(seed) * 0.20);

  const baseAppeal =
    category === "knitwear" ? 0.85 :
    category === "outerwear" ? (priceTier === "commercial" ? 0.80 : priceTier === "mid" ? 0.65 : 0.40) :
    category === "tailoring" ? 0.75 :
    category === "dress" ? (priceTier === "commercial" ? 0.70 : priceTier === "mid" ? 0.55 : 0.35) :
    category === "leather" ? 0.45 :
    0.30;
  const commercialAppeal = Math.max(0.05, Math.min(0.95, baseAppeal - (editorial ? 0.15 : 0) + (rand(seed >> 3) - 0.5) * 0.15));

  return { category, priceTier, editorial, polarity, commercialAppeal };
}

function decideReview(
  store: StoreEntryLike,
  storeProfile: StoreProfile,
  product: Product,
  prof: ProductProfile,
  seed: number
): SyntheticReview | null {
  let participate = storeProfile.participation;
  if (prof.editorial) participate -= (1 - storeProfile.runwayAffinity) * 0.25;
  if (prof.priceTier === "runway") participate -= (1 - storeProfile.runwayAffinity) * 0.15;
  if (rand(seed) > Math.max(0.25, participate)) return null;

  const flagshipBoost = storeProfile.tier === "flagship" ? 0.20 : storeProfile.tier === "premium" ? 0.08 : 0;
  const editorialPenaltySmall =
    prof.editorial && (storeProfile.tier === "small" || storeProfile.tier === "core") ? 0.30 : 0;
  const runwayPenaltySmall =
    prof.priceTier === "runway" && storeProfile.tier === "small" ? 0.20 : 0;

  let pGreen = prof.commercialAppeal * 0.55 + storeProfile.runwayAffinity * 0.25 + flagshipBoost;
  pGreen -= editorialPenaltySmall + runwayPenaltySmall;
  const pol = prof.polarity;
  if (pol > 0.5) {
    if (storeProfile.tier === "flagship") pGreen += 0.15;
    if (storeProfile.tier === "small") pGreen -= 0.18;
  }
  pGreen = Math.max(0.05, Math.min(0.92, pGreen));

  const yellowShare = Math.max(0.05, 0.35 - pol * 0.30);
  const remaining = 1 - pGreen;
  const pYellow = remaining * yellowShare;

  const r = rand(seed >> 5);
  let dec: Decision;
  if (r < pGreen) dec = "green";
  else if (r < pGreen + pYellow) dec = "yellow";
  else dec = "red";

  let units = 0;
  if (dec === "green") {
    const bands: Record<Category, [number, number]> = {
      knitwear:  [2, 5],
      outerwear: prof.priceTier === "runway" ? [1, 2] : [2, 4],
      tailoring: [2, 4],
      dress:     prof.priceTier === "runway" ? [1, 2] : [1, 3],
      leather:   [1, 2],
      evening:   [1, 2],
    };
    const [lo, hi] = bands[prof.category];
    const raw = lo + rand(seed >> 9) * (hi - lo);

    let tierMult = 1;
    if (storeProfile.tier === "flagship") {
      tierMult = prof.editorial || prof.priceTier === "runway" ? 1.6 : 1.1;
    } else if (storeProfile.tier === "premium") {
      tierMult = prof.editorial ? 1.15 : 1.0;
    } else if (storeProfile.tier === "core") {
      tierMult = prof.editorial ? 0.7 : 0.95;
    } else {
      tierMult = prof.editorial ? 0.5 : 0.8;
    }

    units = Math.max(1, Math.round(raw * tierMult));

    if (prof.editorial && rand(seed >> 13) < 0.22) {
      units = Math.max(1, Math.round(units * 0.5));
    }
    if (
      storeProfile.tier === "flagship" &&
      prof.editorial &&
      prof.priceTier === "runway" &&
      rand(seed >> 15) < 0.12
    ) {
      units += 2 + Math.floor(rand(seed >> 21) * 3);
    }

    const perDoorCap =
      storeProfile.tier === "flagship" ? 12 :
      storeProfile.tier === "premium"  ? 8  :
      storeProfile.tier === "core"     ? 6  : 4;
    units = Math.min(units, perDoorCap);
  } else if (dec === "yellow") {
    units = rand(seed >> 11) < 0.22 ? (rand(seed >> 17) < 0.5 ? 1 : 2) : 0;
  }

  let vicProb = storeProfile.vicWeight;
  if (prof.priceTier === "runway") vicProb += 0.08;
  if (prof.category === "evening" || prof.category === "leather") vicProb += 0.05;
  if (storeProfile.tier === "flagship" && prof.editorial) vicProb += 0.10;
  const clientBacked = dec !== "red" && rand(seed >> 19) < Math.min(0.55, vicProb);

  const noteProb = 0.10 + pol * 0.25 + (prof.priceTier === "runway" ? 0.10 : 0);
  const hasNotes = rand(seed >> 23) < noteProb;

  return {
    product_id: product.id,
    store: store.label,
    decision_status: dec,
    requested_bulk_units: units,
    client_backed: clientBacked,
    has_notes: hasNotes,
  };
}

type StoreEntryLike = { code: string; label: string };

function buildSynthetic(products: Product[]): SyntheticReview[] {
  const out: SyntheticReview[] = [];
  const realStores = STORES.filter((s) => !s.code.startsWith("P"));
  const profiles = products.map((p) => ({ p, prof: classifyProduct(p) }));

  realStores.forEach((store) => {
    const sp = profileFor(store.code);
    profiles.forEach(({ p, prof }) => {
      const seed = hash(`${store.code}|${p.style_number}`);
      const row = decideReview(store, sp, p, prof, seed);
      if (row) out.push(row);
    });
  });
  return out;
}

function fromReal(r: Review): SyntheticReview | null {
  if (r.submission_status !== "submitted" || !r.decision_status) return null;
  return {
    product_id: r.product_id,
    store: r.store,
    decision_status: r.decision_status as Decision,
    requested_bulk_units: r.requested_bulk_units ?? 0,
    client_backed: !!r.special_order_notes && r.special_order_notes.trim().length > 0,
    has_notes: !!r.notes && r.notes.trim().length > 0,
  };
}

// ---------- aggregation ----------
const TIER_WEIGHT: Record<StoreTier, number> = {
  flagship: 3.0,
  premium: 1.8,
  core: 1.0,
  small: 0.6,
};

const STORE_TIER_BY_LABEL = new Map<string, StoreTier>(
  STORES.map((s) => [s.label, profileFor(s.code).tier])
);

function tierOf(label: string): StoreTier {
  return STORE_TIER_BY_LABEL.get(label) ?? "core";
}
function weightOf(label: string): number {
  return TIER_WEIGHT[tierOf(label)];
}

type Recommendation =
  | "Buy with confidence"
  | "Increase depth"
  | "Test buy"
  | "Flag for review"
  | "Pass";

interface ProductAgg {
  product: Product;
  category: Category;
  green: number;
  yellow: number;
  red: number;
  units: number;
  weightedUnits: number;
  flagshipUnits: number;
  clientBacked: number;
  notes: number;
  total: number;
  score: number;
  weightedScore: number;
  flags: string[];
  recommendation: Recommendation;
  topStores: { store: string; units: number; tier: StoreTier; clientBacked: boolean }[];
}

function aggregate(products: Product[], rows: SyntheticReview[]): ProductAgg[] {
  const byProduct = new Map<string, SyntheticReview[]>();
  rows.forEach((r) => {
    const a = byProduct.get(r.product_id) ?? [];
    a.push(r);
    byProduct.set(r.product_id, a);
  });

  return products.map((product) => {
    const list = byProduct.get(product.id) ?? [];
    const prof = classifyProduct(product);
    const green = list.filter((r) => r.decision_status === "green").length;
    const yellow = list.filter((r) => r.decision_status === "yellow").length;
    const red = list.filter((r) => r.decision_status === "red").length;
    const units = list.reduce((a, r) => a + (r.requested_bulk_units || 0), 0);
    const weightedUnits = list.reduce(
      (a, r) => a + (r.requested_bulk_units || 0) * weightOf(r.store),
      0
    );
    const flagshipUnits = list
      .filter((r) => tierOf(r.store) === "flagship")
      .reduce((a, r) => a + (r.requested_bulk_units || 0), 0);
    const flagshipGreen = list.filter(
      (r) => tierOf(r.store) === "flagship" && r.decision_status === "green"
    ).length;
    const clientBacked = list.filter((r) => r.client_backed).length;
    const notes = list.filter((r) => r.has_notes).length;
    const total = list.length;

    const greenW = list.filter((r) => r.decision_status === "green").reduce((a, r) => a + weightOf(r.store), 0);
    const yellowW = list.filter((r) => r.decision_status === "yellow").reduce((a, r) => a + weightOf(r.store), 0);
    const redW = list.filter((r) => r.decision_status === "red").reduce((a, r) => a + weightOf(r.store), 0);
    const clientW = list.filter((r) => r.client_backed).reduce((a, r) => a + weightOf(r.store), 0);

    const base = green * 3 + yellow * 1 + red * -1;
    const score = base + units * 0.5 + clientBacked * 2;
    const weightedScore = greenW * 3 + yellowW * 1 + redW * -1 + weightedUnits * 0.5 + clientW * 2;

    const consensus = total > 0 ? Math.max(green, yellow, red) / total : 0;
    const greenRate = total > 0 ? green / total : 0;

    const flags: string[] = [];
    if (units >= 15 && consensus < 0.6) flags.push("High demand / low consensus");
    if (units >= 20 && greenRate < 0.5) flags.push("High units / low confidence");
    if (clientBacked >= 2) flags.push("Client-backed demand");
    if (yellow >= 4 && green >= 4 && red >= 2) flags.push("Polarizing style");
    if (red >= 4 && units >= 10) flags.push("Buyer review needed");
    if (notes >= 5 || (clientBacked >= 3 && notes >= 2)) flags.push("Buyer review needed");
    if (flagshipGreen >= 3 && red >= 4) flags.push("Flagship support / broad rejection");

    let recommendation: Recommendation;
    const flagshipBacked = flagshipGreen >= 2 || flagshipUnits >= 6;
    if (greenRate >= 0.6 && flagshipBacked && consensus >= 0.55) {
      recommendation = "Increase depth";
    } else if (greenRate >= 0.5 && flagshipBacked) {
      recommendation = "Buy with confidence";
    } else if (flagshipBacked && (clientBacked >= 1 || prof.editorial)) {
      recommendation = "Test buy";
    } else if (red >= 5 && greenRate < 0.35) {
      recommendation = "Pass";
    } else if (
      flags.some((f) => f.includes("Buyer review")) ||
      flags.includes("Polarizing style") ||
      flags.includes("High units / low confidence")
    ) {
      recommendation = "Flag for review";
    } else if (greenRate >= 0.45) {
      recommendation = "Test buy";
    } else {
      recommendation = "Flag for review";
    }

    const topStores = list
      .filter((r) => r.requested_bulk_units > 0)
      .sort((a, b) => {
        const wa = b.requested_bulk_units * weightOf(b.store);
        const wb = a.requested_bulk_units * weightOf(a.store);
        return wa - wb;
      })
      .slice(0, 5)
      .map((r) => ({
        store: r.store,
        units: r.requested_bulk_units,
        tier: tierOf(r.store),
        clientBacked: r.client_backed,
      }));

    return {
      product,
      category: prof.category,
      green,
      yellow,
      red,
      units,
      weightedUnits: Math.round(weightedUnits * 10) / 10,
      flagshipUnits,
      clientBacked,
      notes,
      total,
      score: Math.round(score * 10) / 10,
      weightedScore: Math.round(weightedScore * 10) / 10,
      flags: Array.from(new Set(flags)),
      recommendation,
      topStores,
    };
  });
}

// ---------- component ----------
export default function ManagerDashboard() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [{ data: r }, { data: p }] = await Promise.all([
        supabase.from("reviews").select("*"),
        supabase.from("products").select("*").order("sort_order"),
      ]);
      setReviews(r ?? []);
      setProducts(p ?? []);
      setLoading(false);
    })();
  }, []);

  const { rows, useMock } = useMemo(() => {
    const real = reviews.map(fromReal).filter(Boolean) as SyntheticReview[];
    const distinctStores = new Set(real.map((r) => r.store)).size;
    if (distinctStores >= 5 || products.length === 0) return { rows: real, useMock: false };
    const realStores = new Set(real.map((r) => r.store));
    const mocked = buildSynthetic(products).filter((m) => !realStores.has(m.store));
    return { rows: [...real, ...mocked], useMock: true };
  }, [reviews, products]);

  const storeStats = useMemo(() => {
    const map = new Map<string, { submitted: number; complete: boolean }>();
    STORES.forEach((s) => map.set(s.label, { submitted: 0, complete: false }));
    rows.forEach((r) => {
      const cur = map.get(r.store) ?? { submitted: 0, complete: false };
      cur.submitted += 1;
      map.set(r.store, cur);
    });
    return STORES.map((s) => {
      const cur = map.get(s.label)!;
      return {
        ...s,
        submitted: cur.submitted,
        complete: products.length > 0 && cur.submitted >= products.length * 0.9,
      };
    });
  }, [rows, products]);

  const totals = useMemo(() => {
    const submittedStores = storeStats.filter((s) => s.submitted > 0 && !s.code.startsWith("P")).length;
    const green = rows.filter((r) => r.decision_status === "green").length;
    const yellow = rows.filter((r) => r.decision_status === "yellow").length;
    const red = rows.filter((r) => r.decision_status === "red").length;
    const units = rows.reduce((a, r) => a + (r.requested_bulk_units || 0), 0);
    const clientBacked = rows.filter((r) => r.client_backed).length;
    return { submittedStores, green, yellow, red, units, clientBacked };
  }, [rows, storeStats]);

  const aggs = useMemo(() => aggregate(products, rows), [products, rows]);

  const ranked = useMemo(
    () => [...aggs].sort((a, b) => b.weightedScore - a.weightedScore),
    [aggs]
  );
  const categoryBreakdown = useMemo(() => {
    const cats: Category[] = ["dress", "knitwear", "outerwear", "leather", "evening", "tailoring"];
    return cats.map((c) => {
      const list = aggs.filter((a) => a.category === c);
      const units = list.reduce((s, a) => s + a.units, 0);
      const greenStyles = list.filter((a) => a.green >= a.red).length;
      return { category: c, styles: list.length, units, greenStyles };
    });
  }, [aggs]);

  const strongBuy = useMemo(
    () =>
      [...aggs]
        .filter((a) => a.recommendation === "Buy with confidence" || a.recommendation === "Increase depth")
        .sort((a, b) => b.weightedScore - a.weightedScore)
        .slice(0, 3),
    [aggs]
  );
  const mixedSignal = useMemo(
    () =>
      [...aggs]
        .filter(
          (a) =>
            a.recommendation === "Flag for review" ||
            a.flags.includes("Polarizing style") ||
            a.flags.includes("High units / low confidence")
        )
        .sort((a, b) => b.units - a.units)
        .slice(0, 4),
    [aggs]
  );
  const clientHighlights = useMemo(
    () =>
      [...aggs]
        .filter((a) => a.clientBacked > 0)
        .sort((a, b) => b.clientBacked - a.clientBacked || b.units - a.units)
        .slice(0, 4),
    [aggs]
  );

  const realStoresAll = useMemo(
    () => storeStats.filter((s) => !s.code.startsWith("P")),
    [storeStats]
  );
  const totalDecisions = totals.green + totals.yellow + totals.red;

  const aggsLite: AggLite[] = useMemo(
    () =>
      aggs.map((a) => ({
        product: a.product,
        green: a.green,
        yellow: a.yellow,
        red: a.red,
        units: a.units,
        total: a.total,
        recommendation: a.recommendation,
        category: a.category,
      })),
    [aggs]
  );

  const doorRows: DoorRow[] = useMemo(() => {
    const map = new Map<string, DoorRow>();
    rows.forEach((r) => {
      const cur =
        map.get(r.store) ?? {
          store: r.store,
          tier: tierOf(r.store),
          green: 0,
          yellow: 0,
          red: 0,
          units: 0,
        };
      if (r.decision_status === "green") cur.green += 1;
      else if (r.decision_status === "yellow") cur.yellow += 1;
      else cur.red += 1;
      cur.units += r.requested_bulk_units || 0;
      map.set(r.store, cur);
    });
    const tierOrder: Record<DoorRow["tier"], number> = {
      flagship: 0,
      premium: 1,
      core: 2,
      small: 3,
    };
    return Array.from(map.values()).sort((a, b) => {
      const t = tierOrder[a.tier] - tierOrder[b.tier];
      if (t !== 0) return t;
      return b.units - a.units;
    });
  }, [rows]);

  const buyCount = aggs.filter(
    (a) => a.recommendation === "Buy with confidence" || a.recommendation === "Increase depth"
  ).length;

  return (
    <ManagerLayout>
      {/* ---------- Masthead ---------- */}
      <header className="border-b border-[hsl(var(--hairline))] pb-10 pt-2">
        <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-4">
          <div className="max-w-3xl">
            <p className="text-[10px] uppercase tracking-[0.32em] text-muted-foreground bracket-num">
              Season — Buyer Intelligence
            </p>
            <h1 className="mt-4 font-display text-[64px] font-normal leading-[0.92] tracking-tight sm:text-[88px]">
              The <span className="display-italic">Buy.</span>
            </h1>
            <p className="mt-5 max-w-xl text-sm leading-relaxed text-muted-foreground">
              A curated view of door-level conviction across {realStoresAll.length} reviewing
              locations. Weighted toward flagship signal and client-backed intent.
            </p>
          </div>
          <div className="flex items-center gap-6 self-end">
            {useMock && (
              <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
                Demo data layered
              </span>
            )}
            <Link
              to="/manager/submissions"
              className="text-[11px] uppercase tracking-[0.24em] text-foreground underline-offset-8 hover:underline"
            >
              Raw submissions
            </Link>
          </div>
        </div>
      </header>

      {/* ---------- Demand Overview ---------- */}
      <Section eyebrow="01" title="Demand Overview">
        <div className="grid gap-x-10 gap-y-10 lg:grid-cols-[1.1fr_1fr]">
          <HeroRatio
            numerator={buyCount}
            denominator={products.length || aggs.length}
            label="Conviction · styles to buy"
            caption="Styles where flagship-weighted signal supports a buy or deeper depth — the editorial spine of the seasonal order."
          />
          <div className="grid grid-cols-2 gap-y-10 self-end">
            <Figure label="Doors Reporting" value={totals.submittedStores} suffix={` / ${realStoresAll.length}`} />
            <Figure label="Requested Depth" value={totals.units} suffix=" u" />
            <Figure label="Decisions" value={totalDecisions} />
            <Figure label="VIC-Backed" value={totals.clientBacked} />
          </div>
        </div>

        <div className="mt-12 border-t border-[hsl(var(--hairline))] pt-8">
          <p className="mb-4 text-[10px] uppercase tracking-[0.28em] text-muted-foreground bracket-num">
            Conviction Mix
          </p>
          <ConvictionRibbon green={totals.green} yellow={totals.yellow} red={totals.red} />
        </div>
      </Section>

      {/* ---------- Assortment Matrix ---------- */}
      <Section
        eyebrow="02"
        title="Assortment Matrix"
        subtitle="Every style in the season as a single cell. Color is recommendation, opacity is requested depth."
      >
        {loading || aggsLite.length === 0 ? (
          <SkeletonNote />
        ) : (
          <AssortmentMatrix aggs={aggsLite} />
        )}
      </Section>

      {/* ---------- Category Ratios ---------- */}
      <Section
        eyebrow="03"
        title="By Category"
        subtitle="Green-rate and depth distribution across the assortment."
      >
        <CategoryRatios rows={categoryBreakdown} />
      </Section>

      {/* ---------- Door Heatmap ---------- */}
      <Section
        eyebrow="04"
        title="Door Sentiment"
        subtitle="Each door's full conviction mix, sorted by tier. Bar below = depth share."
      >
        {doorRows.length === 0 ? (
          <EmptyNote>No reviews recorded.</EmptyNote>
        ) : (
          <DoorHeatmap rows={doorRows} />
        )}
      </Section>

      {/* ---------- Strong Buy ---------- */}
      <Section eyebrow="05" title="Strong Buy" subtitle="Highest weighted conviction across the network.">
        {loading ? (
          <SkeletonNote />
        ) : strongBuy.length === 0 ? (
          <EmptyNote>No styles meet the conviction threshold yet.</EmptyNote>
        ) : (
          <div className="grid gap-x-10 gap-y-12 md:grid-cols-3">
            {strongBuy.map((a, i) => (
              <EditorialFeature key={a.product.id} a={a} index={i + 1} />
            ))}
          </div>
        )}
      </Section>

      {/* ---------- Mixed Signal ---------- */}
      <Section eyebrow="06" title="Mixed Signal" subtitle="Polarizing assortment requiring buyer judgment.">
        {mixedSignal.length === 0 ? (
          <EmptyNote>The network is in alignment. No styles flagged.</EmptyNote>
        ) : (
          <div className="grid gap-x-12 gap-y-8 md:grid-cols-2">
            {mixedSignal.map((a) => (
              <EditorialRow key={a.product.id} a={a} kind="mixed" />
            ))}
          </div>
        )}
      </Section>

      {/* ---------- Client Demand ---------- */}
      <Section eyebrow="07" title="Client Demand" subtitle="Styles with VIC-backed orders attached.">
        {clientHighlights.length === 0 ? (
          <EmptyNote>No client-backed requests on file.</EmptyNote>
        ) : (
          <div className="grid gap-x-12 gap-y-8 md:grid-cols-2">
            {clientHighlights.map((a) => (
              <EditorialRow key={a.product.id} a={a} kind="client" />
            ))}
          </div>
        )}
      </Section>

      {/* ---------- Door Status ---------- */}
      <Section eyebrow="08" title="Door Status" subtitle="Submission completeness across reviewing locations.">
        <div className="grid grid-cols-1 gap-x-10 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
          {realStoresAll.map((s) => {
            const submitted = s.submitted;
            const target = products.length;
            const pct = target ? Math.min(100, (submitted / target) * 100) : 0;
            const status = s.complete
              ? "Complete"
              : submitted === 0
              ? "Pending"
              : "In progress";
            return (
              <div
                key={s.code}
                className="flex items-center justify-between border-b border-[hsl(var(--hairline))] py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm">{s.label}</p>
                  <p className="mt-0.5 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                    {status}
                  </p>
                </div>
                <div className="ml-4 flex items-center gap-3">
                  <div className="h-px w-20 bg-[hsl(var(--hairline))]">
                    <div
                      className="h-px bg-foreground"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-10 text-right font-display text-sm tabular-nums">
                    {submitted}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      {/* ---------- Reports & Export ---------- */}
      <Section eyebrow="09" title="Reports & Export" subtitle="Take the buy out of the room.">
        <div className="flex flex-wrap items-center justify-between gap-6 border-t border-[hsl(var(--hairline))] pt-8">
          <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
            Generate the seasonal worksheet, the buyer brief, and the door-level export from a
            single, version-controlled source.
          </p>
          <Link
            to="/manager/reports"
            className="text-[11px] uppercase tracking-[0.28em] text-foreground underline-offset-8 hover:underline"
          >
            Open reports →
          </Link>
        </div>
      </Section>

      {/* ---------- Index ---------- */}
      <Section
        eyebrow="10"
        title="Index"
        subtitle="The full assortment, ranked by flagship-weighted conviction."
      >
        {loading ? (
          <SkeletonNote />
        ) : (
          <div className="divide-y divide-[hsl(var(--hairline))] border-y border-[hsl(var(--hairline))]">
            {ranked.map((a, idx) => (
              <IndexRow key={a.product.id} a={a} rank={idx + 1} />
            ))}
          </div>
        )}
      </Section>

      <footer className="mt-20 border-t border-[hsl(var(--hairline))] py-8 text-center">
        <p className="text-[10px] uppercase tracking-[0.32em] text-muted-foreground">
          A L / N E · Buyer Intelligence
        </p>
      </footer>
    </ManagerLayout>
  );
}

// =====================================================================
// Layout primitives
// =====================================================================

function Section({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-20">
      <header className="mb-10 grid gap-1 md:grid-cols-[7rem_1fr] md:items-baseline md:gap-10">
        <span className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted-foreground bracket-num">
          {eyebrow}
        </span>
        <div>
          <h2 className="font-display text-[36px] font-normal leading-[1.05] tracking-tight sm:text-[44px]">
            {title}
          </h2>
          {subtitle && (
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
              {subtitle}
            </p>
          )}
        </div>
      </header>
      <div className="md:pl-[7rem] md:pr-2">{children}</div>
    </section>
  );
}

function Figure({
  label,
  value,
  suffix,
}: {
  label: string;
  value: number | string;
  suffix?: string;
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-3 font-display text-4xl font-normal leading-none tracking-tight sm:text-5xl">
        {value}
        {suffix && (
          <span className="ml-1 align-baseline font-mono text-xs text-muted-foreground">
            {suffix}
          </span>
        )}
      </p>
    </div>
  );
}

function ConvictionRibbon({
  green,
  yellow,
  red,
}: {
  green: number;
  yellow: number;
  red: number;
}) {
  const total = Math.max(green + yellow + red, 1);
  const items: Array<{ key: string; label: string; n: number; bar: string }> = [
    { key: "g", label: "Conviction", n: green, bar: "bg-decision-green" },
    { key: "y", label: "Consideration", n: yellow, bar: "bg-decision-yellow" },
    { key: "r", label: "Pass", n: red, bar: "bg-decision-red" },
  ];
  return (
    <div>
      <div className="flex h-[3px] w-full overflow-hidden">
        {items.map((it) => (
          <div
            key={it.key}
            className={cn("h-full", it.bar)}
            style={{ width: `${(it.n / total) * 100}%` }}
          />
        ))}
      </div>
      <div className="mt-4 grid grid-cols-3 gap-6">
        {items.map((it) => (
          <div key={it.key}>
            <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
              {it.label}
            </p>
            <p className="mt-1 font-display text-2xl tabular-nums">{it.n}</p>
            <p className="text-[11px] text-muted-foreground">
              {Math.round((it.n / total) * 100)}%
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ConvictionLabel({ rec }: { rec: Recommendation }) {
  const tone =
    rec === "Buy with confidence" || rec === "Increase depth"
      ? "text-[hsl(var(--decision-green))]"
      : rec === "Test buy"
      ? "text-[hsl(var(--decision-yellow))]"
      : rec === "Pass"
      ? "text-[hsl(var(--decision-red))]"
      : "text-foreground";
  const display =
    rec === "Buy with confidence"
      ? "Buy"
      : rec === "Increase depth"
      ? "Deepen"
      : rec === "Test buy"
      ? "Test"
      : rec === "Flag for review"
      ? "Review Needed"
      : "Pass";
  return (
    <span className={cn("text-[10px] uppercase tracking-[0.3em]", tone)}>{display}</span>
  );
}

function EditorialFeature({ a, index }: { a: ProductAgg; index: number }) {
  const total = Math.max(a.green + a.yellow + a.red, 1);
  return (
    <article className="group">
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-[hsl(var(--muted))]">
        <ProductImage src={a.product.image_url} alt={a.product.style_number} />
        <span className="absolute left-3 top-3 font-display text-xs tracking-[0.3em] text-foreground/80">
          № {String(index).padStart(2, "0")}
        </span>
      </div>
      <div className="mt-5">
        <ConvictionLabel rec={a.recommendation} />
        <h3 className="mt-2 font-display text-2xl leading-tight tracking-tight">
          {a.product.style_number}
        </h3>
        <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
          {a.product.long_style_desc}
        </p>
        <div className="mt-5 flex h-[2px] w-full overflow-hidden">
          <div className="bg-decision-green" style={{ width: `${(a.green / total) * 100}%` }} />
          <div className="bg-decision-yellow" style={{ width: `${(a.yellow / total) * 100}%` }} />
          <div className="bg-decision-red" style={{ width: `${(a.red / total) * 100}%` }} />
        </div>
        <dl className="mt-4 grid grid-cols-3 gap-4 text-[11px]">
          <Stat2 label="Depth" value={`${a.units}u`} />
          <Stat2 label="Flagship" value={`${a.flagshipUnits}u`} />
          <Stat2 label="VIC" value={a.clientBacked} />
        </dl>
      </div>
    </article>
  );
}

function EditorialRow({
  a,
  kind,
}: {
  a: ProductAgg;
  kind: "mixed" | "client";
}) {
  const total = Math.max(a.green + a.yellow + a.red, 1);
  return (
    <article className="flex gap-5">
      <div className="aspect-[3/4] w-28 shrink-0 overflow-hidden bg-[hsl(var(--muted))] sm:w-32">
        <ProductImage src={a.product.image_url} alt={a.product.style_number} />
      </div>
      <div className="min-w-0 flex-1">
        <ConvictionLabel rec={a.recommendation} />
        <h3 className="mt-1.5 font-display text-xl leading-tight tracking-tight">
          {a.product.style_number}
        </h3>
        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
          {a.product.long_style_desc}
        </p>
        <div className="mt-3 flex h-[2px] w-full overflow-hidden">
          <div className="bg-decision-green" style={{ width: `${(a.green / total) * 100}%` }} />
          <div className="bg-decision-yellow" style={{ width: `${(a.yellow / total) * 100}%` }} />
          <div className="bg-decision-red" style={{ width: `${(a.red / total) * 100}%` }} />
        </div>
        <p className="mt-3 text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
          {kind === "client"
            ? `${a.clientBacked} client-backed · ${a.units}u total`
            : `${a.green}G · ${a.yellow}Y · ${a.red}R · ${a.units}u`}
        </p>
      </div>
    </article>
  );
}

function IndexRow({ a, rank }: { a: ProductAgg; rank: number }) {
  const [open, setOpen] = useState(false);
  const total = Math.max(a.green + a.yellow + a.red, 1);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button className="flex w-full items-center gap-6 py-5 text-left transition-colors hover:bg-[hsl(var(--muted))]/30">
          <span className="w-10 shrink-0 font-display text-sm tabular-nums text-muted-foreground">
            {String(rank).padStart(2, "0")}
          </span>
          <div className="aspect-[3/4] w-14 shrink-0 overflow-hidden bg-[hsl(var(--muted))]">
            <ProductImage src={a.product.image_url} alt={a.product.style_number} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-display text-lg leading-tight tracking-tight">
              {a.product.style_number}
            </p>
            <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
              {a.product.long_style_desc}
            </p>
          </div>
          <div className="hidden w-32 shrink-0 sm:block">
            <div className="flex h-[2px] w-full overflow-hidden">
              <div className="bg-decision-green" style={{ width: `${(a.green / total) * 100}%` }} />
              <div className="bg-decision-yellow" style={{ width: `${(a.yellow / total) * 100}%` }} />
              <div className="bg-decision-red" style={{ width: `${(a.red / total) * 100}%` }} />
            </div>
            <p className="mt-1.5 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              {a.green}G · {a.yellow}Y · {a.red}R
            </p>
          </div>
          <div className="hidden w-20 shrink-0 text-right sm:block">
            <p className="font-display text-base tabular-nums">{a.units}</p>
            <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              Depth
            </p>
          </div>
          <div className="hidden w-32 shrink-0 sm:block">
            <ConvictionLabel rec={a.recommendation} />
          </div>
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform",
              open && "rotate-180"
            )}
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="grid gap-10 pb-8 pl-[3.5rem] pr-2 pt-2 md:grid-cols-3">
          <div>
            <p className="mb-3 text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
              Top Doors
            </p>
            {a.topStores.length === 0 ? (
              <p className="text-xs text-muted-foreground">No depth requested.</p>
            ) : (
              <ul className="space-y-2">
                {a.topStores.map((s) => (
                  <li key={s.store} className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="truncate">
                      {s.store}
                      {s.clientBacked && (
                        <span className="ml-2 text-[10px] uppercase tracking-[0.22em] text-[hsl(var(--decision-green))]">
                          VIC
                        </span>
                      )}
                    </span>
                    <span className="font-display tabular-nums">{s.units}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <p className="mb-3 text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
              Signals
            </p>
            {a.flags.length === 0 ? (
              <p className="text-xs text-muted-foreground">No flags raised.</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {a.flags.map((f) => (
                  <li key={f} className="text-foreground">
                    — {f}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <p className="mb-3 text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
              Specification
            </p>
            <dl className="space-y-2 text-sm">
              <SpecRow label="Price" value={a.product.retail_price ? `$${a.product.retail_price}` : "—"} />
              <SpecRow label="Color" value={a.product.color || "—"} />
              <SpecRow label="Category" value={a.category} />
              <SpecRow label="Weighted" value={String(a.weightedScore)} />
            </dl>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function Stat2({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 font-display text-base tabular-nums">{value}</dd>
    </div>
  );
}

function SpecRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-[hsl(var(--hairline))] pb-1.5">
      <dt className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">{label}</dt>
      <dd className="truncate text-right text-sm capitalize">{value}</dd>
    </div>
  );
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="border-t border-[hsl(var(--hairline))] pt-6 text-sm italic text-muted-foreground">
      {children}
    </p>
  );
}

function SkeletonNote() {
  return (
    <p className="border-t border-[hsl(var(--hairline))] pt-6 text-sm text-muted-foreground">
      Loading…
    </p>
  );
}
