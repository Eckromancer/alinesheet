import { supabase } from "@/integrations/supabase/client";
import { calculatePrivateValuation, type BusinessType, type ValuationResult } from "./valuationEngine";
import { getLiveMarketMultiples } from "./multiplesEngine";

export interface RawIdeaData {
  title: string;
  selftext?: string;
  summary?: string;
  unmet_need?: string;
  idea_id?: string;
}

interface EvaluationResult {
  scraped_metrics: {
    identified_pain_point: string;
    implied_pricing_power_usd: number;
    estimated_addressable_enterprise_accounts: number;
    projected_attainable_arr_usd: number;
  };
  classification: {
    business_type: BusinessType;
    rationale: string;
  };
}

export interface PipelineResult {
  raw: RawIdeaData;
  evaluation: EvaluationResult;
  valuation: ValuationResult;
}

export async function processScrapedIdeaPipeline(
  rawRedditData: RawIdeaData,
  alphaVantageApiKey?: string
): Promise<PipelineResult | null> {
  // Fetch live market multiples and LLM evaluation in parallel
  const [multiples, invokeResult] = await Promise.all([
    getLiveMarketMultiples(alphaVantageApiKey),
    supabase.functions.invoke("evaluate-idea", {
      body: {
        idea_id: rawRedditData.idea_id,
        redditData: rawRedditData,
      },
    }),
  ]);

  const { data, error } = invokeResult;
  if (error || data?.error) {
    throw new Error(error?.message ?? data?.error ?? "Evaluation failed");
  }

  const evaluation = data as EvaluationResult;
  const { projected_attainable_arr_usd } = evaluation.scraped_metrics;
  const { business_type } = evaluation.classification;

  const valuation = calculatePrivateValuation(projected_attainable_arr_usd, business_type, multiples);

  if (!valuation.passesElitePrivateThreshold) {
    return null;
  }

  return { raw: rawRedditData, evaluation, valuation };
}
