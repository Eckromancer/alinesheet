import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// HN Algolia search queries — each targets a different idea-signal phrase
const SEARCH_QUERIES = [
  "is there an app",
  "someone should build",
  "I wish there was",
  "looking for a tool",
  "why doesn't exist",
  "I would pay for",
  "need a tool that",
  "nobody has built",
  "does a service exist",
  "Ask HN: app idea",
];

interface Post {
  reddit_id: string; // reused as generic post id
  subreddit: string; // reused as source label
  title: string;
  body: string;
  score: number;
  num_comments: number;
  created_utc: number;
  permalink: string;
}

interface ExtractedIdea {
  has_idea: boolean;
  summary: string;
  unmet_need: string;
  implied_user: "consumer" | "smb" | "enterprise" | "developer";
}

interface ScoredIdea {
  score_market: number;
  score_demand: number;
  score_competition: number;
  score_novelty: number;
  score_buildability: number;
}

async function fetchHNPosts(windowDays: number): Promise<Post[]> {
  const cutoff = Math.floor(Date.now() / 1000 - windowDays * 86400);
  const seen = new Set<string>();
  const posts: Post[] = [];

  for (const query of SEARCH_QUERIES) {
    const params = new URLSearchParams({
      query,
      tags: "story",
      hitsPerPage: "50",
      numericFilters: `created_at_i>${cutoff}`,
    });

    const url = `https://hn.algolia.com/api/v1/search?${params}`;
    try {
      const resp = await fetch(url, {
        headers: { "User-Agent": "IdeaMiner/1.0" },
      });
      if (!resp.ok) {
        console.log(`HN search failed for "${query}": ${resp.status}`);
        continue;
      }
      const json = await resp.json();
      const hits = json.hits ?? [];

      for (const hit of hits) {
        const id = String(hit.objectID);
        if (seen.has(id)) continue;
        seen.add(id);

        posts.push({
          reddit_id: id,
          subreddit: "HackerNews",
          title: hit.title ?? "",
          body: hit.story_text ?? hit.comment_text ?? "",
          score: hit.points ?? 0,
          num_comments: hit.num_comments ?? 0,
          created_utc: hit.created_at_i ?? 0,
          permalink: `https://news.ycombinator.com/item?id=${id}`,
        });
      }
    } catch (e) {
      console.log(`HN fetch error for "${query}":`, e);
    }
  }

  // Also fetch top Ask HN posts directly
  try {
    const askParams = new URLSearchParams({
      query: "app tool software",
      tags: "ask_hn",
      hitsPerPage: "100",
      numericFilters: `created_at_i>${cutoff}`,
    });
    const askResp = await fetch(`https://hn.algolia.com/api/v1/search?${askParams}`);
    if (askResp.ok) {
      const askJson = await askResp.json();
      for (const hit of askJson.hits ?? []) {
        const id = String(hit.objectID);
        if (seen.has(id)) continue;
        seen.add(id);
        posts.push({
          reddit_id: id,
          subreddit: "HackerNews/AskHN",
          title: hit.title ?? "",
          body: hit.story_text ?? "",
          score: hit.points ?? 0,
          num_comments: hit.num_comments ?? 0,
          created_utc: hit.created_at_i ?? 0,
          permalink: `https://news.ycombinator.com/item?id=${id}`,
        });
      }
    }
  } catch (e) {
    console.log("Ask HN fetch error:", e);
  }

  console.log(`Total HN posts fetched: ${posts.length}`);
  return posts;
}

function filterPosts(posts: Post[], minScore: number, minComments: number): Post[] {
  return posts.filter((p) => {
    // Accept if it meets engagement threshold OR is from Ask HN
    if (p.subreddit === "HackerNews/AskHN") return true;
    if (p.score >= minScore || p.num_comments >= minComments) return true;
    return false;
  });
}

async function extractIdeasBatch(posts: Post[], anthropicKey: string): Promise<Array<ExtractedIdea & { post_index: number }>> {
  const promptItems = posts.map((p, i) =>
    `[${i}] Title: ${p.title.slice(0, 200)}\nBody: ${p.body.slice(0, 400)}`
  ).join("\n\n---\n\n");

  const prompt = `You are analyzing posts from Hacker News and Reddit to find concrete product/app ideas.

For each numbered post below, return a JSON array where each element has:
- "index": the post index number
- "has_idea": true/false — is there a concrete, buildable product or app idea here?
- "summary": one-line summary of the idea (empty string if has_idea is false)
- "unmet_need": the underlying problem or unmet need being expressed (empty if no idea)
- "implied_user": who would use this — one of: "consumer", "smb", "enterprise", "developer"

Only set has_idea=true for posts with a genuinely specific, actionable product idea. Vague posts, complaints without an idea, or pure discussion should be has_idea=false.

Posts:
${promptItems}

Return only a valid JSON array, no other text.`;

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": anthropicKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 4000,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!resp.ok) throw new Error(`Claude API error: ${resp.status}`);
  const json = await resp.json();
  const text = json.content?.[0]?.text ?? "[]";

  try {
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    const results = JSON.parse(jsonMatch ? jsonMatch[0] : text);
    return results.map((r: ExtractedIdea & { index: number }) => ({ ...r, post_index: r.index }));
  } catch {
    return [];
  }
}

async function clusterAndDedup(
  ideas: Array<ExtractedIdea & { permalink: string }>,
  anthropicKey: string
): Promise<Array<ExtractedIdea & { demand_count: number; source_permalinks: string[] }>> {
  if (ideas.length <= 1) {
    return ideas.map((i) => ({ ...i, demand_count: 1, source_permalinks: [i.permalink] }));
  }

  const prompt = `You have a list of app ideas extracted from tech forums. Group them by similarity — ideas that address the same core problem should be in the same group. Return a JSON array of groups, where each group has:
- "representative": the best/clearest summary of the idea from the group (pick the best one or synthesize)
- "unmet_need": best unmet need description
- "implied_user": most specific user type ("consumer", "smb", "enterprise", or "developer")
- "indices": array of original idea indices that belong to this group

Ideas:
${ideas.map((idea, i) => `[${i}] ${idea.summary}`).join("\n")}

Return only valid JSON, no other text.`;

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": anthropicKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 3000,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!resp.ok) {
    return ideas.map((i) => ({ ...i, demand_count: 1, source_permalinks: [i.permalink] }));
  }

  const json = await resp.json();
  const text = json.content?.[0]?.text ?? "[]";

  try {
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    const groups = JSON.parse(jsonMatch ? jsonMatch[0] : text);
    return groups.map((g: { representative: string; unmet_need: string; implied_user: string; indices: number[] }) => ({
      has_idea: true,
      summary: g.representative,
      unmet_need: g.unmet_need,
      implied_user: g.implied_user as ExtractedIdea["implied_user"],
      demand_count: g.indices.length,
      source_permalinks: g.indices.map((i: number) => ideas[i]?.permalink).filter(Boolean),
    }));
  } catch {
    return ideas.map((i) => ({ ...i, demand_count: 1, source_permalinks: [i.permalink] }));
  }
}

async function scoreIdeas(
  ideas: Array<{ summary: string; unmet_need: string }>,
  anthropicKey: string
): Promise<ScoredIdea[]> {
  const prompt = `Score each app idea on a scale of 1-5 for these criteria:
- score_market: Could this serve a large or growing market? (1=tiny niche, 5=massive market)
- score_demand: How strong is the expressed demand? (1=vague wish, 5=people saying "I'd pay")
- score_competition: How low is competition/saturation? (1=crowded space, 5=underserved gap)
- score_novelty: How differentiated from existing solutions? (1=clone, 5=genuinely new angle)
- score_buildability: How feasible for a small team MVP? (1=requires huge infrastructure, 5=can ship in weeks)

Ideas:
${ideas.map((idea, i) => `[${i}] ${idea.summary}\nNeed: ${idea.unmet_need}`).join("\n\n")}

Return a JSON array with one object per idea, each containing: index, score_market, score_demand, score_competition, score_novelty, score_buildability. Return only valid JSON.`;

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": anthropicKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!resp.ok) throw new Error(`Claude scoring failed: ${resp.status}`);
  const json = await resp.json();
  const text = json.content?.[0]?.text ?? "[]";

  try {
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    return JSON.parse(jsonMatch ? jsonMatch[0] : text);
  } catch {
    return ideas.map((_, i) => ({
      index: i,
      score_market: 3,
      score_demand: 3,
      score_competition: 3,
      score_novelty: 3,
      score_buildability: 3,
    }));
  }
}

async function checkCompetition(summary: string, braveKey: string): Promise<string> {
  const query = encodeURIComponent(`${summary} app`);
  const resp = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${query}&count=5`, {
    headers: {
      Accept: "application/json",
      "Accept-Encoding": "gzip",
      "X-Subscription-Token": braveKey,
    },
  });

  if (!resp.ok) return "";

  const json = await resp.json();
  const results = json.web?.results ?? [];
  if (!results.length) return "No obvious competitors found.";

  return results.slice(0, 3).map((r: { title: string; url: string }) =>
    `${r.title} (${new URL(r.url).hostname})`
  ).join("; ");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization");

    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader ?? "" } },
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const { data: settings } = await adminClient
      .from("user_settings")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!settings?.anthropic_api_key) {
      return new Response(JSON.stringify({ error: "Missing Anthropic API key in settings" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: scanRun, error: scanRunError } = await adminClient
      .from("scan_runs")
      .insert({ user_id: user.id, status: "running" })
      .select()
      .single();

    if (scanRunError) throw scanRunError;
    const scanRunId = scanRun.id;

    const windowDays = settings.scan_window_days ?? 30;
    const minScore = settings.min_score ?? 10;
    const minComments = settings.min_comments ?? 5;

    const allPosts = await fetchHNPosts(windowDays);
    const filtered = filterPosts(allPosts, minScore, minComments);
    console.log(`Posts after filter: ${filtered.length}`);

    if (filtered.length > 0) {
      await adminClient.from("reddit_posts").upsert(
        filtered.map((p) => ({
          scan_run_id: scanRunId,
          user_id: user.id,
          ...p,
          passed_filter: true,
        })),
        { onConflict: "user_id,reddit_id" }
      );
    }

    await adminClient.from("scan_runs").update({ posts_ingested: filtered.length }).eq("id", scanRunId);

    const BATCH_SIZE = 10;
    const extractedIdeas: Array<ExtractedIdea & { permalink: string }> = [];

    for (let i = 0; i < filtered.length; i += BATCH_SIZE) {
      const batch = filtered.slice(i, i + BATCH_SIZE);
      const results = await extractIdeasBatch(batch, settings.anthropic_api_key);
      for (const r of results) {
        if (r.has_idea && r.summary) {
          extractedIdeas.push({
            ...r,
            permalink: batch[r.post_index]?.permalink ?? "",
          });
        }
      }
    }

    console.log(`Extracted ideas: ${extractedIdeas.length}`);

    const clustered = await clusterAndDedup(extractedIdeas, settings.anthropic_api_key);
    const scores = await scoreIdeas(clustered, settings.anthropic_api_key);

    const TOP_N = 20;
    const scored = clustered.map((idea, i) => {
      const s = scores[i] ?? { score_market: 3, score_demand: 3, score_competition: 3, score_novelty: 3, score_buildability: 3 };
      const composite = (s.score_market + s.score_demand + s.score_competition + s.score_novelty + s.score_buildability) / 5;
      return { ...idea, ...s, composite_score: composite };
    }).sort((a, b) => b.composite_score - a.composite_score);

    const topIdeas = scored.slice(0, TOP_N);

    for (const idea of topIdeas) {
      if (settings.brave_search_api_key) {
        idea.competitors = await checkCompetition(idea.summary, settings.brave_search_api_key);
      }
    }

    for (const idea of topIdeas) {
      if (idea.competitors && idea.competitors !== "No obvious competitors found.") {
        const competitorCount = (idea.competitors.match(/;/g) ?? []).length + 1;
        idea.score_competition = Math.max(1, idea.score_competition - Math.floor(competitorCount / 2));
        idea.composite_score = (idea.score_market + idea.score_demand + idea.score_competition + idea.score_novelty + idea.score_buildability) / 5;
      }
    }

    topIdeas.sort((a, b) => b.composite_score - a.composite_score);

    if (topIdeas.length > 0) {
      await adminClient.from("ideas").insert(
        topIdeas.map((idea) => ({
          scan_run_id: scanRunId,
          user_id: user.id,
          summary: idea.summary,
          unmet_need: idea.unmet_need,
          implied_user: idea.implied_user,
          demand_count: idea.demand_count,
          source_permalinks: idea.source_permalinks,
          score_market: idea.score_market,
          score_demand: idea.score_demand,
          score_competition: idea.score_competition,
          score_novelty: idea.score_novelty,
          score_buildability: idea.score_buildability,
          composite_score: idea.composite_score,
          competitors: idea.competitors ?? null,
        }))
      );
    }

    await adminClient.from("scan_runs").update({
      status: "done",
      finished_at: new Date().toISOString(),
      ideas_extracted: topIdeas.length,
    }).eq("id", scanRunId);

    return new Response(
      JSON.stringify({ success: true, ideas_count: topIdeas.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Scan error:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
