import type { BusinessType } from "./valuationEngine";

export type MarketMultiples = Record<BusinessType, number>;

// Default fallback multiples for mid-2026
const DEFAULT_MULTIPLES: MarketMultiples = {
  ELITE_AGENTIC_ORCHESTRATION: 20.0,
  STANDARD_B2B_SAAS: 12.5,
  COMPLEX_MARKETPLACE: 8.0,
  THIN_WRAPPER_CONSUMER: 3.5,
};

// MSFT used as a public tech-sector bellwether for P/E proxy
const BELLWETHER_SYMBOL = "MSFT";

// P/E baseline for mid-2026 calibration (derived from 5-year avg)
const PE_BASELINE = 28.5;

/**
 * Dynamically adjusts baseline multiples using the Alpha Vantage OVERVIEW endpoint.
 * Scales private market multiples by how far the current tech P/E sits above or below
 * the calibration baseline, clamped to a safe operational bracket of [0.8, 1.3].
 *
 * Falls back to DEFAULT_MULTIPLES on any network or parse failure.
 */
export async function getLiveMarketMultiples(apiKey?: string): Promise<MarketMultiples> {
  if (!apiKey) return DEFAULT_MULTIPLES;

  try {
    const url = new URL("https://www.alphavantage.co/query");
    url.searchParams.set("function", "OVERVIEW");
    url.searchParams.set("symbol", BELLWETHER_SYMBOL);
    url.searchParams.set("apikey", apiKey);

    const response = await fetch(url.toString());
    if (!response.ok) return DEFAULT_MULTIPLES;

    const data = await response.json();
    if (!data?.PERatio || data.PERatio === "None") return DEFAULT_MULTIPLES;

    const peRatio = parseFloat(data.PERatio);
    if (!isFinite(peRatio) || peRatio <= 0) return DEFAULT_MULTIPLES;

    // Map P/E deviation onto a private-market scaling coefficient
    const dynamicModifier = Math.min(Math.max(peRatio / PE_BASELINE, 0.8), 1.3);

    const scale = (base: number) => Math.round(base * dynamicModifier * 10) / 10;

    return {
      ELITE_AGENTIC_ORCHESTRATION: scale(DEFAULT_MULTIPLES.ELITE_AGENTIC_ORCHESTRATION),
      STANDARD_B2B_SAAS: scale(DEFAULT_MULTIPLES.STANDARD_B2B_SAAS),
      COMPLEX_MARKETPLACE: scale(DEFAULT_MULTIPLES.COMPLEX_MARKETPLACE),
      THIN_WRAPPER_CONSUMER: scale(DEFAULT_MULTIPLES.THIN_WRAPPER_CONSUMER),
    };
  } catch (error) {
    console.warn("Using baseline standard multiples due to connection timeout:", error);
    return DEFAULT_MULTIPLES;
  }
}
