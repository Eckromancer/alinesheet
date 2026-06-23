import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Post {
  reddit_id: string;
  subreddit: string;
  title: string;
  body: string;
  score: number;
  num_comments: number;
  created_utc: number;
  permalink: string;
}

interface Idea {
  summary: string;
  unmet_need: string;
  implied_user: string;
  score_market: number;
  score_demand: number;
  score_competition: number;
  score_novelty: number;
  score_buildability: number;
  composite_score: number;
  permalink: string;
}

async function fetchHNPosts(windowDays: number): Promise<Post[]> {
  const cutoff = Math.floor(Date.now() / 1000 - windowDays * 86400);
  const seen = new Set<string>();
  const posts: Post[] = [];

  const queries = [
    { q: "is there an app", tag: "story" },
    { q: "I wish there was", tag: "story" },
    { q: "someone should build", tag: "story" },
    { q: "app tool software", tag: "ask_hn" },
  ];

  const fetches = queries.map(({ q, tag }) => {
    const params = new URLSearchParams({
      query: q, tags: tag, hitsPerPage: "50",
      numericFilters: `created_at_i>${cutoff}`,
    });
    return fetch(`https://hn.algolia.com/api/v1/search?${params}`)
      .then(r => r.ok ? r.json() : { hits: [] })
      .catch(() => ({ hits: [] }));
  });

  const results = await Promise.all(fetches);
  for (const json of results) {
    for (const hit of json.hits ?? []) {
      const id = String(hit.objectID);
      if (seen.has(id)) continue;
      seen.add(id);
      posts.push({
        reddit_id: id,
        subreddit: "HackerNews",
        title: hit.title ?? "",
        body: (hit.story_text ?? hit.comment_text ?? "").slice(0, 300),
        score: hit.points ?? 0,
        num_comments: hit.num_comments ?? 0,
        created_utc: hit.created_at_i ?? 0,
        permalink: `https://news.ycombinator.com/item?id=${id}`,
      });
    }
  }

  console.log(`Fetched ${posts.length} HN posts`);
  return posts.slice(0, 20);
}

async function extractAndScore(posts: Post[], anthropicKey: string): Promise<Idea[]> {
  const items = posts.map((p, i) =>
    `[${i}] "${p.title}" — ${p.body.slice(0, 200)}`
  ).join("\n");

  const prompt = `Analyze these Hacker News posts. For each one that contains a SPECIFIC, buildable app or product idea, return a JSON object. Skip vague or non-idea posts.

Return a JSON array. Each element:
{
  "index": <post index>,
  "summary": "<one-line app idea>",
  "unmet_need": "<problem being solved>",
  "implied_user": "consumer" | "smb" | "enterprise" | "developer",
  "score_market": <1-5>,
  "score_demand": <1-5>,
  "score_competition": <1-5, 5=underserved>,
  "score_novelty": <1-5>,
  "score_buildability": <1-5>
}

Posts:
${items}

Return ONLY a valid JSON array. No markdown, no explanation.`;

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": anthropicKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 3000,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Claude error ${resp.status}: ${err}`);
  }

  const json = await resp.json();
  const text = json.content?.[0]?.text ?? "[]";

  try {
    const match = text.match(/\[[\s\S]*\]/);
    const raw = JSON.parse(match ? match[0] : text);
    return raw
      .filter((r: Record<string, unknown>) => r.summary)
      .map((r: Record<string, unknown>) => ({
        summary: r.summary as string,
        unmet_need: r.unmet_need as string ?? "",
        implied_user: r.implied_user as string ?? "consumer",
        score_market: Number(r.score_market) || 3,
        score_demand: Number(r.score_demand) || 3,
        score_competition: Number(r.score_competition) || 3,
        score_novelty: Number(r.score_novelty) || 3,
        score_buildability: Number(r.score_buildability) || 3,
        composite_score: (
          (Number(r.score_market) || 3) +
          (Number(r.score_demand) || 3) +
          (Number(r.score_competition) || 3) +
          (Number(r.score_novelty) || 3) +
          (Number(r.score_buildability) || 3)
        ) / 5,
        permalink: posts[r.index as number]?.permalink ?? "",
      }));
  } catch (e) {
    console.error("Parse error:", e, "Raw text:", text.slice(0, 500));
    return [];
  }
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
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const { data: settings } = await adminClient
      .from("user_settings").select("*").eq("user_id", user.id).maybeSingle();

    if (!settings?.anthropic_api_key) {
      return new Response(JSON.stringify({ error: "Add your Anthropic API key in Settings first." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: scanRun, error: scanRunError } = await adminClient
      .from("scan_runs").insert({ user_id: user.id, status: "running" }).select().single();
    if (scanRunError) throw scanRunError;
    const scanRunId = scanRun.id;

    const windowDays = settings.scan_window_days ?? 30;

    // Fetch posts
    const posts = await fetchHNPosts(windowDays);
    await adminClient.from("scan_runs").update({ posts_ingested: posts.length }).eq("id", scanRunId);

    // Extract + score in one Claude call
    const ideas = await extractAndScore(posts, settings.anthropic_api_key);
    console.log(`Got ${ideas.length} ideas`);

    const top = ideas.sort((a, b) => b.composite_score - a.composite_score).slice(0, 20);

    if (top.length > 0) {
      await adminClient.from("ideas").insert(
        top.map((idea) => ({
          scan_run_id: scanRunId,
          user_id: user.id,
          summary: idea.summary,
          unmet_need: idea.unmet_need,
          implied_user: idea.implied_user,
          demand_count: 1,
          source_permalinks: [idea.permalink],
          score_market: idea.score_market,
          score_demand: idea.score_demand,
          score_competition: idea.score_competition,
          score_novelty: idea.score_novelty,
          score_buildability: idea.score_buildability,
          composite_score: idea.composite_score,
          competitors: null,
        }))
      );
    }

    await adminClient.from("scan_runs").update({
      status: "done",
      finished_at: new Date().toISOString(),
      ideas_extracted: top.length,
    }).eq("id", scanRunId);

    return new Response(
      JSON.stringify({ success: true, ideas_count: top.length }),
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
