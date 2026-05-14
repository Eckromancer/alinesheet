import { useEffect, useMemo, useState } from "react";
import ManagerLayout from "@/components/ManagerLayout";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { STORES } from "@/lib/stores";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import ProductImage from "@/components/ProductImage";
import { Link } from "react-router-dom";
import {
  Store,
  CircleAlert,
  CheckCircle2,
  Layers,
  Sparkles,
  Heart,
  AlertTriangle,
  Flame,
  TrendingUp,
  ChevronDown,
  Crown,
  ArrowUpRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

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
function pick<T>(seed: number, arr: T[]): T {
  return arr[seed % arr.length];
}
// deterministic [0,1)
function rand(seed: number): number {
  return ((seed * 2654435761) >>> 0) / 0x100000000;
}

// ---------- store + product profiling ----------
type StoreTier = "flagship" | "premium" | "core" | "small";
interface StoreProfile {
  tier: StoreTier;
  participation: number; // 0..1 likelihood a given style is reviewed
  depthMult: number; // multiplier on requested units
  vicWeight: number; // VIC / client-backed propensity
  runwayAffinity: number; // 0..1 willingness to back editorial/runway
  responseLag: number; // 0..1, higher = later/incomplete
}

const STORE_PROFILES: Record<string, StoreProfile> = {
  // Flagships — deep buy, runway, high VIC
  "1019": { tier: "flagship", participation: 0.99, depthMult: 1.55, vicWeight: 0.32, runwayAffinity: 0.92, responseLag: 0.05 }, // Michigan Avenue
  "1011": { tier: "flagship", participation: 0.98, depthMult: 1.45, vicWeight: 0.30, runwayAffinity: 0.90, responseLag: 0.08 }, // Fashion Island
  "1012": { tier: "flagship", participation: 0.97, depthMult: 1.35, vicWeight: 0.28, runwayAffinity: 0.88, responseLag: 0.10 }, // San Francisco
  "1005": { tier: "flagship", participation: 0.99, depthMult: 1.60, vicWeight: 0.38, runwayAffinity: 0.95, responseLag: 0.04 }, // Bal Harbour
  "1010": { tier: "flagship", participation: 0.97, depthMult: 1.40, vicWeight: 0.30, runwayAffinity: 0.90, responseLag: 0.08 }, // Los Angeles
  // Premium luxury doors
  "1002": { tier: "premium", participation: 0.93, depthMult: 1.20, vicWeight: 0.22, runwayAffinity: 0.72, responseLag: 0.15 }, // Northpark
  "1014": { tier: "premium", participation: 0.92, depthMult: 1.15, vicWeight: 0.20, runwayAffinity: 0.70, responseLag: 0.18 }, // Westchester
  "1020": { tier: "premium", participation: 0.92, depthMult: 1.10, vicWeight: 0.18, runwayAffinity: 0.68, responseLag: 0.18 }, // Boston
  "1023": { tier: "premium", participation: 0.90, depthMult: 1.10, vicWeight: 0.18, runwayAffinity: 0.65, responseLag: 0.20 }, // Tysons
  "1025": { tier: "premium", participation: 0.91, depthMult: 1.15, vicWeight: 0.20, runwayAffinity: 0.68, responseLag: 0.18 }, // Short Hills
  "1009": { tier: "premium", participation: 0.88, depthMult: 1.05, vicWeight: 0.16, runwayAffinity: 0.60, responseLag: 0.22 }, // Northbrook
  // Core volume doors
  "1004": { tier: "core", participation: 0.82, depthMult: 0.95, vicWeight: 0.12, runwayAffinity: 0.45, responseLag: 0.30 }, // Houston
  "1006": { tier: "core", participation: 0.80, depthMult: 0.90, vicWeight: 0.11, runwayAffinity: 0.42, responseLag: 0.32 }, // Atlanta
  "1030": { tier: "core", participation: 0.80, depthMult: 0.90, vicWeight: 0.10, runwayAffinity: 0.40, responseLag: 0.32 }, // King Of Prussia
  "1034": { tier: "core", participation: 0.78, depthMult: 0.95, vicWeight: 0.13, runwayAffinity: 0.45, responseLag: 0.30 }, // Coral Gables
  "1038": { tier: "core", participation: 0.78, depthMult: 0.92, vicWeight: 0.12, runwayAffinity: 0.42, responseLag: 0.32 }, // Boca Raton
  "1027": { tier: "core", participation: 0.76, depthMult: 0.85, vicWeight: 0.09, runwayAffinity: 0.38, responseLag: 0.40 }, // Denver
  "1102": { tier: "core", participation: 0.74, depthMult: 0.82, vicWeight: 0.08, runwayAffinity: 0.35, responseLag: 0.45 }, // Charlotte
  // Smaller / commercial-leaning doors (more incomplete, conservative)
  "1001": { tier: "small", participation: 0.62, depthMult: 0.70, vicWeight: 0.06, runwayAffinity: 0.25, responseLag: 0.65 }, // Downtown
  "1003": { tier: "small", participation: 0.60, depthMult: 0.70, vicWeight: 0.05, runwayAffinity: 0.22, responseLag: 0.68 }, // Ft. Worth
  "1016": { tier: "small", participation: 0.66, depthMult: 0.72, vicWeight: 0.07, runwayAffinity: 0.28, responseLag: 0.55 }, // San Diego
  "1029": { tier: "small", participation: 0.55, depthMult: 0.65, vicWeight: 0.05, runwayAffinity: 0.20, responseLag: 0.78 }, // Scottsdale
  "1033": { tier: "small", participation: 0.62, depthMult: 0.70, vicWeight: 0.06, runwayAffinity: 0.25, responseLag: 0.65 }, // Troy
  "1036": { tier: "small", participation: 0.64, depthMult: 0.72, vicWeight: 0.07, runwayAffinity: 0.28, responseLag: 0.58 }, // Orlando
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
  editorial: boolean; // statement/runway-coded styles
  polarity: number; // 0..1, how divisive
  commercialAppeal: number; // 0..1, broad consensus draw
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

  // "editorial" — statement pieces flagships chase
  const editorialKeywords = /(degradé|degrade|appaloosa|intarsia|fringe|guipure|sequin|lurex|asymmetrical|deconstructed|reversible|plaid|tweed|bouclé|boucle|horsehair)/.test(d);
  const editorial = editorialKeywords || (priceTier === "runway" && (category === "leather" || category === "evening" || category === "outerwear"));

  // polarity heuristic: editorial leather/evening/runway most polarizing; knit core least
  const seed = hash(p.style_number);
  const basePol =
    category === "knitwear" ? 0.10 :
    category === "outerwear" ? (editorial ? 0.55 : 0.25) :
    category === "tailoring" ? 0.20 :
    category === "dress" ? (editorial ? 0.55 : 0.30) :
    category === "leather" ? 0.65 :
    /* evening */ 0.75;
  const polarity = Math.min(0.95, basePol + rand(seed) * 0.20);

  // commercial appeal: knit + tailoring + outerwear at lower price = strong consensus
  const baseAppeal =
    category === "knitwear" ? 0.85 :
    category === "outerwear" ? (priceTier === "commercial" ? 0.80 : priceTier === "mid" ? 0.65 : 0.40) :
    category === "tailoring" ? 0.75 :
    category === "dress" ? (priceTier === "commercial" ? 0.70 : priceTier === "mid" ? 0.55 : 0.35) :
    category === "leather" ? 0.45 :
    /* evening */ 0.30;
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
  // Participation: smaller stores skip more, especially on runway/editorial
  let participate = storeProfile.participation;
  if (prof.editorial) participate -= (1 - storeProfile.runwayAffinity) * 0.25;
  if (prof.priceTier === "runway") participate -= (1 - storeProfile.runwayAffinity) * 0.15;
  if (rand(seed) > Math.max(0.25, participate)) return null;

  // Probability of green based on store + product alignment
  const flagshipBoost = storeProfile.tier === "flagship" ? 0.20 : storeProfile.tier === "premium" ? 0.08 : 0;
  const editorialPenaltySmall =
    prof.editorial && (storeProfile.tier === "small" || storeProfile.tier === "core") ? 0.30 : 0;
  const runwayPenaltySmall =
    prof.priceTier === "runway" && storeProfile.tier === "small" ? 0.20 : 0;

  let pGreen = prof.commercialAppeal * 0.55 + storeProfile.runwayAffinity * 0.25 + flagshipBoost;
  pGreen -= editorialPenaltySmall + runwayPenaltySmall;
  // Polarity pulls vote to extremes (less yellow)
  const pol = prof.polarity;
  // For polarizing styles, flagships skew green, small skew red
  if (pol > 0.5) {
    if (storeProfile.tier === "flagship") pGreen += 0.15;
    if (storeProfile.tier === "small") pGreen -= 0.18;
  }
  pGreen = Math.max(0.05, Math.min(0.92, pGreen));

  // Yellow share shrinks when polarity is high
  const yellowShare = Math.max(0.05, 0.35 - pol * 0.30);
  const remaining = 1 - pGreen;
  const pYellow = remaining * yellowShare;
  const pRed = remaining - pYellow;

  const r = rand(seed >> 5);
  let dec: Decision;
  if (r < pGreen) dec = "green";
  else if (r < pGreen + pYellow) dec = "yellow";
  else dec = "red";

  // Units — luxury RTW depth: shallow per door, selective, restrained.
  // Individual style requests rarely exceed mid-single-digits; flagships go
  // deeper only on aligned editorial/runway statements; small doors stay
  // conservative; evening/leather are test-buy depth almost everywhere.
  let units = 0;
  if (dec === "green") {
    // Per-door luxury depth bands (min..max) — operationally believable.
    // Knitwear/tailoring = broadest depth; evening/leather = test buys.
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

    // Store-tier depth posture
    let tierMult = 1;
    if (storeProfile.tier === "flagship") {
      // Flagships: deeper, but ONLY on aligned statement/editorial pieces.
      // On commercial basics they buy normal depth, not inflated.
      tierMult = prof.editorial || prof.priceTier === "runway" ? 1.6 : 1.1;
    } else if (storeProfile.tier === "premium") {
      tierMult = prof.editorial ? 1.15 : 1.0;
    } else if (storeProfile.tier === "core") {
      // Core doors lean commercial — penalize editorial depth
      tierMult = prof.editorial ? 0.7 : 0.95;
    } else {
      // small doors: conservative across the board, very shy on editorial
      tierMult = prof.editorial ? 0.5 : 0.8;
    }

    units = Math.max(1, Math.round(raw * tierMult));

    // Merchant restraint: occasional "love it, hold the depth" test buy
    if (prof.editorial && rand(seed >> 13) < 0.22) {
      units = Math.max(1, Math.round(units * 0.5));
    }
    // Flagship statement concentration: rare deep bet on a hero style
    if (
      storeProfile.tier === "flagship" &&
      prof.editorial &&
      prof.priceTier === "runway" &&
      rand(seed >> 15) < 0.12
    ) {
      units += 2 + Math.floor(rand(seed >> 21) * 3); // +2..+4
    }

    // Hard luxury cap per door per style — keeps individual asks believable
    const perDoorCap =
      storeProfile.tier === "flagship" ? 12 :
      storeProfile.tier === "premium"  ? 8  :
      storeProfile.tier === "core"     ? 6  : 4;
    units = Math.min(units, perDoorCap);
  } else if (dec === "yellow") {
    // Yellow = soft maybe; rarely a unit ask, capped at 2 trial pieces.
    units = rand(seed >> 11) < 0.22 ? (rand(seed >> 17) < 0.5 ? 1 : 2) : 0;
  } else {
    units = 0;
  }

  // VIC / client-backed
  let vicProb = storeProfile.vicWeight;
  if (prof.priceTier === "runway") vicProb += 0.08;
  if (prof.category === "evening" || prof.category === "leather") vicProb += 0.05;
  if (storeProfile.tier === "flagship" && prof.editorial) vicProb += 0.10;
  const clientBacked = dec !== "red" && rand(seed >> 19) < Math.min(0.55, vicProb);

  // Notes — more for polarizing/runway/leather
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

// Convert a real review row to the same shape used for aggregation.
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

    // Weighted scoring — flagships count meaningfully more than small doors
    const greenW = list
      .filter((r) => r.decision_status === "green")
      .reduce((a, r) => a + weightOf(r.store), 0);
    const yellowW = list
      .filter((r) => r.decision_status === "yellow")
      .reduce((a, r) => a + weightOf(r.store), 0);
    const redW = list
      .filter((r) => r.decision_status === "red")
      .reduce((a, r) => a + weightOf(r.store), 0);
    const clientW = list
      .filter((r) => r.client_backed)
      .reduce((a, r) => a + weightOf(r.store), 0);

    const base = green * 3 + yellow * 1 + red * -1;
    const score = base + units * 0.5 + clientBacked * 2;
    const weightedScore =
      greenW * 3 + yellowW * 1 + redW * -1 + weightedUnits * 0.5 + clientW * 2;

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

    // Recommendation logic
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
    // Augment: keep real rows but layer in mock data for stores not yet reporting
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
    const incompleteStores = storeStats.filter(
      (s) => !s.code.startsWith("P") && !s.complete
    ).length;
    const green = rows.filter((r) => r.decision_status === "green").length;
    const yellow = rows.filter((r) => r.decision_status === "yellow").length;
    const red = rows.filter((r) => r.decision_status === "red").length;
    const units = rows.reduce((a, r) => a + (r.requested_bulk_units || 0), 0);
    const clientBacked = rows.filter((r) => r.client_backed).length;
    return { submittedStores, incompleteStores, green, yellow, red, units, clientBacked };
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
  const highestDemand = useMemo(() => [...aggs].sort((a, b) => b.units - a.units).slice(0, 5), [aggs]);
  const polarizing = useMemo(
    () =>
      [...aggs]
        .filter((a) => a.total >= 5)
        .sort((a, b) => {
          const ap = Math.min(a.green, a.red) * a.yellow;
          const bp = Math.min(b.green, b.red) * b.yellow;
          return bp - ap;
        })
        .slice(0, 5),
    [aggs]
  );
  const highRiskHighDemand = useMemo(
    () =>
      [...aggs]
        .filter((a) => a.units >= 8 && a.green / Math.max(a.total, 1) < 0.55)
        .sort((a, b) => b.units - a.units)
        .slice(0, 5),
    [aggs]
  );
  const depthByStore = useMemo(() => {
    const m = new Map<string, number>();
    rows.forEach((r) => m.set(r.store, (m.get(r.store) ?? 0) + (r.requested_bulk_units || 0)));
    return Array.from(m.entries())
      .map(([store, units]) => ({ store, units }))
      .sort((a, b) => b.units - a.units)
      .slice(0, 6);
  }, [rows]);
  const incompleteByStore = useMemo(
    () =>
      storeStats
        .filter((s) => !s.code.startsWith("P") && !s.complete)
        .map((s) => ({
          store: s.label,
          submitted: s.submitted,
          target: products.length,
        }))
        .sort((a, b) => a.submitted - b.submitted)
        .slice(0, 8),
    [storeStats, products.length]
  );

  return (
    <ManagerLayout>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-medium tracking-tight">Buyer Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Aggregated DSA insight across {STORES.filter((s) => !s.code.startsWith("P")).length} doors
            {useMock && (
              <span className="ml-2 inline-flex items-center rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-widest text-muted-foreground">
                Demo data layered
              </span>
            )}
          </p>
        </div>
        <Link
          to="/manager/submissions"
          className="text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground"
        >
          View raw submissions →
        </Link>
      </div>

      {/* KPI cards */}
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={Store} label="Stores submitted" value={totals.submittedStores} />
        <Stat icon={CircleAlert} label="Stores incomplete" value={totals.incompleteStores} tone="warn" />
        <Stat icon={Layers} label="Total requested units" value={totals.units} />
        <Stat icon={Heart} label="Client-backed requests" value={totals.clientBacked} tone="accent" />
        <Stat icon={CheckCircle2} label="Green selections" value={totals.green} tone="green" />
        <Stat icon={Sparkles} label="Yellow selections" value={totals.yellow} tone="yellow" />
        <Stat icon={AlertTriangle} label="Red selections" value={totals.red} tone="red" />
        <Stat
          icon={TrendingUp}
          label="Total decisions"
          value={totals.green + totals.yellow + totals.red}
        />
      </div>

      {/* Insight panels */}
      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Panel title="Highest demand styles" icon={Flame}>
          <MiniList
            items={highestDemand.map((a) => ({
              primary: a.product.style_number,
              secondary: a.product.long_style_desc,
              right: `${a.units} units`,
            }))}
          />
        </Panel>
        <Panel title="Most polarizing styles" icon={AlertTriangle}>
          <MiniList
            items={polarizing.map((a) => ({
              primary: a.product.style_number,
              secondary: `${a.green}G · ${a.yellow}Y · ${a.red}R`,
              right: `${a.total} votes`,
            }))}
          />
        </Panel>
        <Panel title="High units · low confidence" icon={CircleAlert}>
          <MiniList
            items={highRiskHighDemand.map((a) => ({
              primary: a.product.style_number,
              secondary: `${a.units} units · ${a.green}G ${a.yellow}Y ${a.red}R`,
              right: "Review",
            }))}
          />
        </Panel>
        <Panel title="Stores requesting most depth" icon={TrendingUp}>
          <MiniList
            items={depthByStore.map((d) => ({
              primary: d.store,
              secondary: "Total units requested",
              right: `${d.units}`,
            }))}
          />
        </Panel>
        <Panel title="Incomplete submissions by store" icon={CircleAlert} className="lg:col-span-2">
          {incompleteByStore.length === 0 ? (
            <p className="text-sm text-muted-foreground">All stores complete.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {incompleteByStore.map((s) => (
                <div
                  key={s.store}
                  className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2 text-sm"
                >
                  <span className="truncate">{s.store}</span>
                  <span className="text-xs text-muted-foreground">
                    {s.submitted} / {s.target || "—"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      {/* Category assortment balance */}
      <Card className="mb-6 p-4 shadow-soft">
        <div className="mb-3 flex items-center gap-2">
          <Layers className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
            Assortment balance by category
          </h3>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {categoryBreakdown.map((c) => {
            const totalUnits = categoryBreakdown.reduce((s, x) => s + x.units, 0) || 1;
            const pct = Math.round((c.units / totalUnits) * 100);
            return (
              <div key={c.category} className="rounded-md border border-border bg-muted/30 p-3">
                <div className="mb-1 flex items-baseline justify-between">
                  <span className="text-sm font-medium capitalize">{c.category}</span>
                  <span className="text-xs text-muted-foreground">{c.styles} styles</span>
                </div>
                <div className="mb-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-primary"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{c.units} units · {pct}%</span>
                  <span>{c.greenStyles} positive</span>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Buyer-friendly expandable ranking */}
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="font-display text-xl">Ranked by Buyer Priority</h2>
        <span className="text-xs text-muted-foreground hidden sm:inline">
          Flagship-weighted · tap a card to expand
        </span>
      </div>

      {loading ? (
        <Card className="p-6 text-center text-muted-foreground">Loading…</Card>
      ) : (
        <div className="grid gap-3">
          {ranked.map((a, idx) => (
            <ProductCard key={a.product.id} a={a} rank={idx + 1} />
          ))}
        </div>
      )}
    </ManagerLayout>
  );
}

// ---------- Product card ----------
function recommendationStyle(rec: Recommendation): { cls: string; icon: typeof Crown } {
  switch (rec) {
    case "Buy with confidence":
      return { cls: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300", icon: CheckCircle2 };
    case "Increase depth":
      return { cls: "border-emerald-600/40 bg-emerald-600/15 text-emerald-700 dark:text-emerald-300", icon: TrendingUp };
    case "Test buy":
      return { cls: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300", icon: Sparkles };
    case "Flag for review":
      return { cls: "border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300", icon: AlertTriangle };
    case "Pass":
      return { cls: "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300", icon: CircleAlert };
  }
}

function tierBadgeCls(t: StoreTier): string {
  switch (t) {
    case "flagship":
      return "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300";
    case "premium":
      return "border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-300";
    case "core":
      return "border-border bg-muted text-foreground";
    case "small":
      return "border-border bg-muted/40 text-muted-foreground";
  }
}

function ProductCard({ a, rank }: { a: ProductAgg; rank: number }) {
  const [open, setOpen] = useState(false);
  const rs = recommendationStyle(a.recommendation);
  const RecIcon = rs.icon;
  const total = Math.max(a.green + a.yellow + a.red, 1);
  return (
    <Card className="overflow-hidden shadow-soft">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <button className="flex w-full items-stretch gap-3 p-3 text-left hover:bg-muted/30 sm:gap-4 sm:p-4">
            <div className="w-20 shrink-0 sm:w-24">
              <ProductImage src={a.product.image_url} alt={a.product.style_number} />
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                      #{rank}
                    </span>
                    <span className="font-medium">{a.product.style_number}</span>
                    <span className="text-xs capitalize text-muted-foreground">
                      · {a.category}
                    </span>
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                    {a.product.long_style_desc}
                  </p>
                </div>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                    open && "rotate-180"
                  )}
                />
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant="outline" className={cn("gap-1 text-[10px] uppercase tracking-wider", rs.cls)}>
                  <RecIcon className="h-3 w-3" />
                  {a.recommendation}
                </Badge>
                {a.flagshipUnits > 0 && (
                  <Badge variant="outline" className="gap-1 border-amber-500/40 bg-amber-500/10 text-[10px] uppercase tracking-wider text-amber-700 dark:text-amber-300">
                    <Crown className="h-3 w-3" />
                    Flagship {a.flagshipUnits}u
                  </Badge>
                )}
                {a.clientBacked > 0 && (
                  <Badge variant="outline" className="gap-1 border-emerald-500/30 bg-emerald-500/10 text-[10px] uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                    <Heart className="h-3 w-3" />
                    {a.clientBacked} VIC
                  </Badge>
                )}
              </div>

              {/* Decision distribution bar */}
              <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-emerald-500" style={{ width: `${(a.green / total) * 100}%` }} />
                <div className="h-full bg-amber-500" style={{ width: `${(a.yellow / total) * 100}%` }} />
                <div className="h-full bg-rose-500" style={{ width: `${(a.red / total) * 100}%` }} />
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                <span><span className="text-emerald-600 dark:text-emerald-400">●</span> {a.green}G</span>
                <span><span className="text-amber-600 dark:text-amber-400">●</span> {a.yellow}Y</span>
                <span><span className="text-rose-600 dark:text-rose-400">●</span> {a.red}R</span>
                <span>· {a.units} units</span>
                <span className="ml-auto font-display text-sm text-foreground">{a.weightedScore}</span>
              </div>
            </div>
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="border-t border-border bg-muted/20 p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <h4 className="mb-2 text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
                  Top requesting stores
                </h4>
                {a.topStores.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No depth requested yet.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {a.topStores.map((s) => (
                      <li
                        key={s.store}
                        className="flex items-center justify-between gap-2 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs"
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <Badge
                            variant="outline"
                            className={cn("text-[9px] uppercase tracking-wider", tierBadgeCls(s.tier))}
                          >
                            {s.tier}
                          </Badge>
                          <span className="truncate">{s.store}</span>
                          {s.clientBacked && <Heart className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />}
                        </div>
                        <span className="font-medium">{s.units}u</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <h4 className="mb-2 text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
                  Risk flags
                </h4>
                {a.flags.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No flags raised.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {a.flags.map((f) => (
                      <Badge
                        key={f}
                        variant="outline"
                        className={cn(
                          "text-[10px] uppercase tracking-wider",
                          f.includes("Client")
                            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                            : f.includes("Polarizing")
                              ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                              : "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300"
                        )}
                      >
                        {f}
                      </Badge>
                    ))}
                  </div>
                )}

                <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-md border border-border bg-background p-2">
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Price</div>
                    <div className="font-medium">{a.product.retail_price ? `$${a.product.retail_price}` : "—"}</div>
                  </div>
                  <div className="rounded-md border border-border bg-background p-2">
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Color</div>
                    <div className="truncate font-medium">{a.product.color || "—"}</div>
                  </div>
                  <div className="rounded-md border border-border bg-background p-2">
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Weighted</div>
                    <div className="font-medium">{a.weightedScore}</div>
                  </div>
                </div>

                <div className="mt-4 flex justify-end">
                  <Button asChild variant="outline" size="sm" className="gap-1">
                    <Link to="/manager/submissions">
                      View submissions <ArrowUpRight className="h-3 w-3" />
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

// ---------- subcomponents ----------
function Stat({
  icon: Icon,
  label,
  value,
  tone = "default",
}: {
  icon: typeof Store;
  label: string;
  value: number | string;
  tone?: "default" | "green" | "yellow" | "red" | "warn" | "accent";
}) {
  const toneCls = {
    default: "text-foreground",
    green: "text-emerald-600 dark:text-emerald-400",
    yellow: "text-amber-600 dark:text-amber-400",
    red: "text-rose-600 dark:text-rose-400",
    warn: "text-amber-600 dark:text-amber-400",
    accent: "text-fuchsia-600 dark:text-fuchsia-400",
  }[tone];
  return (
    <Card className="p-4 shadow-soft">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-widest text-muted-foreground">{label}</span>
        <Icon className={cn("h-4 w-4", toneCls)} />
      </div>
      <div className={cn("font-display text-3xl font-medium leading-none", toneCls)}>{value}</div>
    </Card>
  );
}

function Panel({
  title,
  icon: Icon,
  children,
  className,
}: {
  title: string;
  icon: typeof Store;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("p-4 shadow-soft", className)}>
      <div className="mb-3 flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
          {title}
        </h3>
      </div>
      {children}
    </Card>
  );
}

function MiniList({
  items,
}: {
  items: { primary: string; secondary: string; right: string }[];
}) {
  if (items.length === 0)
    return <p className="text-sm text-muted-foreground">No data yet.</p>;
  return (
    <ul className="divide-y divide-border">
      {items.map((it, i) => (
        <li key={i} className="flex items-center justify-between gap-3 py-2 text-sm">
          <div className="min-w-0">
            <div className="truncate font-medium">{it.primary}</div>
            <div className="truncate text-xs text-muted-foreground">{it.secondary}</div>
          </div>
          <span className="shrink-0 text-xs font-medium text-muted-foreground">{it.right}</span>
        </li>
      ))}
    </ul>
  );
}
