import Anthropic from "https://esm.sh/@anthropic-ai/sdk@0.39.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are an institutional venture analyst. Your core objective is to analyze scraped text data, extract underlying economic metrics, and structure them into valid JSON for our calculation engine.

### EXTRACTION & INFERENCE RULES
1. Currency Normalization: Convert all local currencies, pricing mentions, or budget complaints into standardized USD.
2. Market Capture Mapping: Estimate a conservative Year 5 Annual Recurring Revenue (ARR) based on the size of the user base complaining and a standard contract value (e.g., $50/month for consumer, $5,000/month for enterprise).
3. Business Classification: Categorize the architecture into one of these exact keys:
   - "ELITE_AGENTIC_ORCHESTRATION" (Deep automation, sovereign data, complex workflows)
   - "STANDARD_B2B_SAAS" (Standard operational workflow systems)
   - "COMPLEX_MARKETPLACE" (Connecting buyers/sellers, handling logistics)
   - "THIN_WRAPPER_CONSUMER" (Simple features easily replaced by platform updates)

### REQUIRED OUTPUT SCHEMA
You must output strictly valid JSON. Do not include markdown codeblocks or conversational text.

{
  "scraped_metrics": {
    "identified_pain_point": "<concise description of the core problem>",
    "implied_pricing_power_usd": <integer, estimated annual contract value per customer in USD>,
    "estimated_addressable_enterprise_accounts": <integer, realistic TAM account count>,
    "projected_attainable_arr_usd": <integer, conservative Year 5 ARR in USD>
  },
  "classification": {
    "business_type": <"ELITE_AGENTIC_ORCHESTRATION" | "STANDARD_B2B_SAAS" | "COMPLEX_MARKETPLACE" | "THIN_WRAPPER_CONSUMER">,
    "rationale": "<one sentence explaining the classification>"
  }
}`;

export interface EvaluationResult {
  scraped_metrics: {
    identified_pain_point: string;
    implied_pricing_power_usd: number;
    estimated_addressable_enterprise_accounts: number;
    projected_attainable_arr_usd: number;
  };
  classification: {
    business_type: "ELITE_AGENTIC_ORCHESTRATION" | "STANDARD_B2B_SAAS" | "COMPLEX_MARKETPLACE" | "THIN_WRAPPER_CONSUMER";
    rationale: string;
  };
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
