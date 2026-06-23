import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Settings, LogOut, Download, RefreshCw, Star, StarOff, ExternalLink } from "lucide-react";

interface Idea {
  id: string;
  summary: string;
  unmet_need: string | null;
  implied_user: string | null;
  demand_count: number;
  source_permalinks: string[];
  score_market: number | null;
  score_demand: number | null;
  score_competition: number | null;
  score_novelty: number | null;
  score_buildability: number | null;
  composite_score: number | null;
  competitors: string | null;
  saved: boolean;
  created_at: string;
}

interface ScanRun {
  id: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  posts_ingested: number;
  ideas_extracted: number;
  error_message: string | null;
}

function ScoreDot({ score }: { score: number | null }) {
  if (!score) return <span className="text-gray-600">—</span>;
  const colors = ["", "bg-red-500", "bg-orange-500", "bg-yellow-500", "bg-lime-500", "bg-green-500"];
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className={`h-2 w-2 rounded-full ${i <= score ? colors[score] : "bg-gray-700"}`} />
      ))}
    </div>
  );
}

function IdeaRow({ idea, rank, onToggleSave }: { idea: Idea; rank: number; onToggleSave: (id: string, saved: boolean) => void }) {
  const userColors: Record<string, string> = {
    consumer: "bg-blue-900 text-blue-300",
    smb: "bg-purple-900 text-purple-300",
    enterprise: "bg-gray-700 text-gray-300",
    developer: "bg-green-900 text-green-300",
  };

  return (
    <tr className="border-b border-gray-800 hover:bg-gray-900/50 transition-colors">
      <td className="py-3 px-3 text-center">
        <span className="text-lg font-bold text-gray-500">#{rank}</span>
      </td>
      <td className="py-3 px-3 min-w-[220px]">
        <div className="font-medium text-white text-sm">{idea.summary}</div>
        {idea.unmet_need && (
          <div className="text-xs text-gray-400 mt-1 line-clamp-2">{idea.unmet_need}</div>
        )}
      </td>
      <td className="py-3 px-3">
        {idea.implied_user && (
          <Badge className={`text-xs ${userColors[idea.implied_user] ?? "bg-gray-700 text-gray-300"}`}>
            {idea.implied_user}
          </Badge>
        )}
      </td>
      <td className="py-3 px-3 text-center">
        <span className="text-white font-semibold">{idea.demand_count}</span>
        <div className="text-xs text-gray-500">posts</div>
      </td>
      <td className="py-3 px-3">
        <div className="text-xl font-bold text-orange-400 text-center">
          {idea.composite_score ? idea.composite_score.toFixed(1) : "—"}
        </div>
      </td>
      <td className="py-3 px-3">
        <div className="space-y-1 text-xs text-gray-400">
          <div className="flex items-center gap-2 justify-between"><span>Market</span><ScoreDot score={idea.score_market} /></div>
          <div className="flex items-center gap-2 justify-between"><span>Demand</span><ScoreDot score={idea.score_demand} /></div>
          <div className="flex items-center gap-2 justify-between"><span>Comp.</span><ScoreDot score={idea.score_competition} /></div>
          <div className="flex items-center gap-2 justify-between"><span>Novel</span><ScoreDot score={idea.score_novelty} /></div>
          <div className="flex items-center gap-2 justify-between"><span>Build</span><ScoreDot score={idea.score_buildability} /></div>
        </div>
      </td>
      <td className="py-3 px-3 max-w-[200px]">
        {idea.competitors ? (
          <p className="text-xs text-gray-400 line-clamp-3">{idea.competitors}</p>
        ) : (
          <span className="text-xs text-gray-600">Not checked</span>
        )}
      </td>
      <td className="py-3 px-3">
        <div className="flex flex-wrap gap-1">
          {idea.source_permalinks.slice(0, 3).map((link, i) => (
            <a
              key={i}
              href={`https://reddit.com${link}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-orange-400 hover:text-orange-300 transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          ))}
        </div>
      </td>
      <td className="py-3 px-3">
        <button
          onClick={() => onToggleSave(idea.id, !idea.saved)}
          className="text-gray-500 hover:text-yellow-400 transition-colors"
        >
          {idea.saved ? <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" /> : <StarOff className="h-4 w-4" />}
        </button>
      </td>
    </tr>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [lastRun, setLastRun] = useState<ScanRun | null>(null);
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState("");

  const fetchIdeas = useCallback(async () => {
    const { data: runData } = await supabase
      .from("scan_runs")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    setLastRun(runData ?? null);

    if (runData?.id) {
      const { data } = await supabase
        .from("ideas")
        .select("*")
        .eq("scan_run_id", runData.id)
        .order("composite_score", { ascending: false });
      setIdeas((data as Idea[]) ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserEmail(data.user?.email ?? ""));
    fetchIdeas();
  }, [fetchIdeas]);

  // Poll while a scan is running
  useEffect(() => {
    if (!scanning && lastRun?.status !== "running") return;
    const interval = setInterval(async () => {
      await fetchIdeas();
      if (lastRun?.status === "done" || lastRun?.status === "error") {
        setScanning(false);
        clearInterval(interval);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [scanning, lastRun?.status, fetchIdeas]);

  const runScan = async () => {
    const { data: settings } = await supabase
      .from("user_settings")
      .select("reddit_client_id, anthropic_api_key")
      .maybeSingle();

    if (!settings?.reddit_client_id || !settings?.anthropic_api_key) {
      toast.error("Set up your API keys in Settings first.");
      navigate("/settings");
      return;
    }

    setScanning(true);
    toast.info("Scan started — this takes 1–2 minutes.");

    const { error } = await supabase.functions.invoke("run-scan");
    if (error) {
      toast.error(`Scan failed: ${error.message}`);
      setScanning(false);
    } else {
      await fetchIdeas();
      setScanning(false);
      toast.success("Scan complete!");
    }
  };

  const toggleSave = async (id: string, saved: boolean) => {
    await supabase.from("ideas").update({ saved }).eq("id", id);
    setIdeas((prev) => prev.map((i) => (i.id === id ? { ...i, saved } : i)));
  };

  const exportCSV = () => {
    if (!ideas.length) return;
    const headers = ["rank","summary","need","user_type","demand_count","composite","market","demand","competition","novelty","buildability","competitors","sources"];
    const rows = ideas.map((idea, i) => [
      i + 1,
      `"${idea.summary.replace(/"/g, '""')}"`,
      `"${(idea.unmet_need ?? "").replace(/"/g, '""')}"`,
      idea.implied_user ?? "",
      idea.demand_count,
      idea.composite_score ?? "",
      idea.score_market ?? "",
      idea.score_demand ?? "",
      idea.score_competition ?? "",
      idea.score_novelty ?? "",
      idea.score_buildability ?? "",
      `"${(idea.competitors ?? "").replace(/"/g, '""')}"`,
      `"${idea.source_permalinks.map(l => `https://reddit.com${l}`).join(", ")}"`,
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ideas-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  const savedIdeas = ideas.filter((i) => i.saved);

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-950/80 sticky top-0 z-10 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">💡</span>
            <div>
              <h1 className="font-bold text-white leading-none">Reddit Idea Miner</h1>
              <p className="text-xs text-gray-400">{userEmail}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {lastRun && (
              <span className="text-xs text-gray-500 hidden sm:block">
                Last scan: {new Date(lastRun.started_at).toLocaleDateString()}
                {lastRun.status === "running" && (
                  <Badge className="ml-2 bg-orange-900 text-orange-300 text-xs">Running…</Badge>
                )}
              </span>
            )}
            <Button variant="outline" size="sm" onClick={exportCSV} disabled={!ideas.length}
              className="border-gray-700 text-gray-300 hover:text-white hover:border-gray-500">
              <Download className="h-4 w-4 mr-1" /> CSV
            </Button>
            <Button
              size="sm"
              onClick={runScan}
              disabled={scanning}
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              {scanning
                ? <><RefreshCw className="h-4 w-4 mr-1 animate-spin" /> Scanning…</>
                : <><RefreshCw className="h-4 w-4 mr-1" /> Run Scan</>
              }
            </Button>
            <Button variant="ghost" size="icon" onClick={() => navigate("/settings")}
              className="text-gray-400 hover:text-white">
              <Settings className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={signOut}
              className="text-gray-400 hover:text-white">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Scan status banner */}
        {scanning && (
          <div className="mb-4 rounded-lg bg-orange-950 border border-orange-800 px-4 py-3 flex items-center gap-3">
            <RefreshCw className="h-4 w-4 text-orange-400 animate-spin flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-orange-300">Scan in progress</p>
              <p className="text-xs text-orange-400">Fetching posts → extracting ideas → scoring → competition check</p>
            </div>
          </div>
        )}
        {lastRun?.status === "error" && (
          <div className="mb-4 rounded-lg bg-red-950 border border-red-800 px-4 py-3">
            <p className="text-sm font-medium text-red-300">Last scan failed</p>
            <p className="text-xs text-red-400">{lastRun.error_message}</p>
          </div>
        )}

        <Tabs defaultValue="all">
          <div className="flex items-center justify-between mb-4">
            <TabsList className="bg-gray-900 border border-gray-800">
              <TabsTrigger value="all" className="data-[state=active]:bg-gray-800">
                All Ideas {ideas.length > 0 && <Badge className="ml-1 bg-gray-700 text-gray-300 text-xs">{ideas.length}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="saved" className="data-[state=active]:bg-gray-800">
                Saved {savedIdeas.length > 0 && <Badge className="ml-1 bg-yellow-900 text-yellow-300 text-xs">{savedIdeas.length}</Badge>}
              </TabsTrigger>
            </TabsList>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-24">
              <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              <TabsContent value="all">
                <IdeasTableView ideas={ideas} onToggleSave={toggleSave} />
              </TabsContent>
              <TabsContent value="saved">
                <IdeasTableView ideas={savedIdeas} onToggleSave={toggleSave} />
              </TabsContent>
            </>
          )}
        </Tabs>
      </main>
    </div>
  );
}

function IdeasTableView({ ideas, onToggleSave }: { ideas: Idea[]; onToggleSave: (id: string, saved: boolean) => void }) {
  if (ideas.length === 0) {
    return (
      <div className="text-center py-24 text-gray-500">
        <div className="text-5xl mb-4">🔍</div>
        <p className="text-lg font-medium text-gray-400">No ideas yet</p>
        <p className="text-sm mt-1">Hit "Run Scan" to mine Reddit for opportunities</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-800">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-800 bg-gray-900/60 text-xs uppercase tracking-wide text-gray-400">
            <th className="py-3 px-3 text-center w-10">#</th>
            <th className="py-3 px-3 text-left">Idea</th>
            <th className="py-3 px-3 text-left">User</th>
            <th className="py-3 px-3 text-center w-16">Demand</th>
            <th className="py-3 px-3 text-center w-16">Score</th>
            <th className="py-3 px-3 text-left w-36">Breakdown</th>
            <th className="py-3 px-3 text-left">Competitors</th>
            <th className="py-3 px-3 text-center w-20">Sources</th>
            <th className="py-3 px-3 w-10"></th>
          </tr>
        </thead>
        <tbody>
          {ideas.map((idea, i) => (
            <IdeaRow key={idea.id} idea={idea} rank={i + 1} onToggleSave={onToggleSave} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
