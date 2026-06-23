import Anthropic from "https://esm.sh/@anthropic-ai/sdk@0.39.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are an elite Venture Capital Investment Principal specializing in 2026/2027 macroeconomic trends. Evaluate raw scraped app concepts and calculate their quantitative unicorn potential based on capital efficiency, AI-native defensibility, and market scale.

You MUST respond with ONLY a valid JSON object matching this exact schema — no markdown, no explanation, no code fences:

{
  "unicorn_potential_score": <integer 0-100>,
  "tier": <"S" | "A" | "B" | "C" | "D">,
  "weighted_scores": {
    "capital_efficiency": <integer 1-10>,
    "ai_native_defensibility": <integer 1-10>,
    "market_scale": <integer 1-10>,
    "timing_score": <integer 1-10>,
    "execution_risk": <integer 1-10, 10=lowest risk>
  },
  "vulnerability_bottlenecks": [<string>, ...],
  "moat_assessment": <string, one sentence>,
  "recommended_gtm": <string, one sentence>,
  "verdict": <string, two sentences max>
}

Tier mapping: S=85-100, A=70-84, B=50-69, C=30-49, D=0-29.
unicorn_potential_score = weighted average: capital_efficiency×20% + ai_native_defensibility×25% + market_scale×25% + timing_score×15% + execution_risk×15%, scaled to 0-100.`;

export interface EvaluationResult {
  unicorn_potential_score: number;
  tier: "S" | "A" | "B" | "C" | "D";
  weighted_scores: {
    capital_efficiency: number;
    ai_native_defensibility: number;
    market_scale: number;
    timing_score: number;
    execution_risk: number;
  };
  vulnerability_bottlenecks: string[];
  moat_assessment: string;
  recommended_gtm: string;
  verdict: string;
}

export async function evaluateScrapedIdea(
  redditData: { title: string; selftext?: string; unmet_need?: string; summary?: string },
  anthropicApiKey: string
): Promise<EvaluationResult> {
  const client = new Anthropic({ apiKey: anthropicApiKey });

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1500,
    temperature: 0.1,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Evaluate this scraped idea and calculate the 2026/2027 scoring framework:\n\n${JSON.stringify(redditData, null, 2)}`,
      },
    ],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";

  // Strip any accidental markdown fences before parsing
  const clean = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const jsonMatch = clean.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error(`No JSON in response: ${text.slice(0, 200)}`);
  return JSON.parse(jsonMatch[0]) as EvaluationResult;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const authHeader = req.headers.get("Authorization");

    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader ?? "" } },
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: settings } = await adminClient
      .from("user_settings").select("anthropic_api_key").eq("user_id", user.id).maybeSingle();

    if (!settings?.anthropic_api_key) {
      return new Response(JSON.stringify({ error: "Missing Anthropic API key in settings" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { idea_id, redditData } = body;

    if (!redditData) {
      return new Response(JSON.stringify({ error: "redditData is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await evaluateScrapedIdea(redditData, settings.anthropic_api_key);

    // Persist evaluation back to the idea row if idea_id provided
    if (idea_id) {
      await adminClient.from("ideas").update({
        evaluation: result,
      }).eq("id", idea_id).eq("user_id", user.id);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Evaluate error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
