/**
 * 2026 Private Market Valuation Matrix
 * Multiples fluctuate based on technological defensibility and market tailwinds
 */
export const MARKET_MULTIPLES = {
  ELITE_AGENTIC_ORCHESTRATION: 20, // Premium tier for highly automated, high-margin AI/Agent architectures
  STANDARD_B2B_SAAS: 12,           // Baseline for high-retention software platforms
  COMPLEX_MARKETPLACE: 8,          // High transaction volume, lower gross margins
  THIN_WRAPPER_CONSUMER: 3,        // Low defensibility, heavy churn risk
} as const;

export type BusinessType = keyof typeof MARKET_MULTIPLES;

export interface ValuationResult {
  multipleUsed: string;
  estimatedValuationUSD: number;
  formattedValuation: string;
  passesElitePrivateThreshold: boolean;
  gapToThresholdUSD: number;
}

/**
 * Calculates valuation based on estimated market size capture and modern multiples.
 * Pass `multiples` to override the static defaults with live market data.
 */
export function calculatePrivateValuation(
  projectedARR: number,
  businessType: BusinessType | string,
  multiples: Partial<typeof MARKET_MULTIPLES> = MARKET_MULTIPLES
): ValuationResult {
  const multiple =
    multiples[businessType as BusinessType] ?? MARKET_MULTIPLES[businessType as BusinessType] ?? MARKET_MULTIPLES.STANDARD_B2B_SAAS;
  const estimatedValuation = projectedARR * multiple;

  const TARGET_THRESHOLD = 1_000_000_000;
  const isElitePrivateStatus = estimatedValuation >= TARGET_THRESHOLD;

  return {
    multipleUsed: `${multiple}x ARR`,
    estimatedValuationUSD: estimatedValuation,
    formattedValuation: new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(estimatedValuation),
    passesElitePrivateThreshold: isElitePrivateStatus,
    gapToThresholdUSD: isElitePrivateStatus ? 0 : TARGET_THRESHOLD - estimatedValuation,
  };
}
