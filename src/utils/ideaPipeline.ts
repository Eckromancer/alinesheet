import { supabase } from "@/integrations/supabase/client";
import { calculatePrivateValuation, type BusinessType, type ValuationResult } from "./valuationEngine";

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
  rawRedditData: RawIdeaData
): Promise<PipelineResult | null> {
  const { data, error } = await supabase.functions.invoke("evaluate-idea", {
    body: {
      idea_id: rawRedditData.idea_id,
      redditData: rawRedditData,
    },
  });

  if (error || data?.error) {
    throw new Error(error?.message ?? data?.error ?? "Evaluation failed");
  }

  const evaluation = data as EvaluationResult;
  const { projected_attainable_arr_usd } = evaluation.scraped_metrics;
  const { business_type } = evaluation.classification;

  const valuation = calculatePrivateValuation(projected_attainable_arr_usd, business_type);

  if (!valuation.passesElitePrivateThreshold) {
    return null;
  }

  return { raw: rawRedditData, evaluation, valuation };
}
