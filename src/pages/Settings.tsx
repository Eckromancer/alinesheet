import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, ExternalLink, Eye, EyeOff } from "lucide-react";

interface Settings {
  reddit_client_id: string;
  reddit_client_secret: string;
  anthropic_api_key: string;
  brave_search_api_key: string;
  scan_window_days: number;
  min_score: number;
  min_comments: number;
}

function SecretInput({ id, label, value, onChange, placeholder, hint, helpUrl, helpLabel }: {
  id: string; label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; hint?: string; helpUrl?: string; helpLabel?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label htmlFor={id} className="text-gray-300">{label}</Label>
        {helpUrl && (
          <a href={helpUrl} target="_blank" rel="noopener noreferrer"
            className="text-xs text-orange-400 hover:text-orange-300 flex items-center gap-1">
            {helpLabel ?? "Get key"} <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
      <div className="relative">
        <Input
          id={id}
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="bg-gray-900 border-gray-700 text-white pr-10"
        />
        <button type="button" onClick={() => setShow(!show)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {hint && <p className="text-xs text-gray-500">{hint}</p>}
    </div>
  );
}

export default function Settings() {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Settings>({
    reddit_client_id: "",
    reddit_client_secret: "",
    anthropic_api_key: "",
    brave_search_api_key: "",
    scan_window_days: 30,
    min_score: 10,
    min_comments: 5,
  });

  useEffect(() => {
    supabase.from("user_settings").select("*").maybeSingle().then(({ data }) => {
      if (data) setForm((f) => ({ ...f, ...data }));
    });
  }, []);

  const set = (key: keyof Settings) => (v: string | number) =>
    setForm((f) => ({ ...f, [key]: v }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from("user_settings").upsert({
      user_id: user.id,
      ...form,
      updated_at: new Date().toISOString(),
    });

    setSaving(false);
    if (error) toast.error("Failed to save settings.");
    else toast.success("Settings saved.");
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b border-gray-800 bg-gray-950/80 sticky top-0 z-10 backdrop-blur">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}
            className="text-gray-400 hover:text-white">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="font-bold text-white">Settings</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        <form onSubmit={save} className="space-y-8">

          {/* Reddit */}
          <section className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
            <div>
              <h2 className="font-semibold text-white">Reddit API</h2>
              <p className="text-sm text-gray-400 mt-0.5">
                Create a "script" app at{" "}
                <a href="https://www.reddit.com/prefs/apps" target="_blank" rel="noopener noreferrer"
                  className="text-orange-400 hover:underline">reddit.com/prefs/apps</a>{" "}
                → click "create another app" → type: script.
              </p>
            </div>
            <SecretInput
              id="reddit_client_id" label="Client ID" value={form.reddit_client_id}
              onChange={set("reddit_client_id")} placeholder="14-char alphanumeric"
              hint="Shown below the app name on the preferences page"
            />
            <SecretInput
              id="reddit_client_secret" label="Client Secret" value={form.reddit_client_secret}
              onChange={set("reddit_client_secret")} placeholder="Longer secret string"
            />
          </section>

          {/* Anthropic */}
          <section className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
            <div>
              <h2 className="font-semibold text-white">Anthropic (Claude)</h2>
              <p className="text-sm text-gray-400 mt-0.5">Used for idea extraction and scoring.</p>
            </div>
            <SecretInput
              id="anthropic_api_key" label="API Key" value={form.anthropic_api_key}
              onChange={set("anthropic_api_key")} placeholder="sk-ant-..."
              helpUrl="https://console.anthropic.com/settings/keys"
              helpLabel="Get from console"
            />
          </section>

          {/* Brave Search */}
          <section className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
            <div>
              <h2 className="font-semibold text-white">Brave Search API <span className="text-gray-500 font-normal text-sm">(optional)</span></h2>
              <p className="text-sm text-gray-400 mt-0.5">
                Used for the competition check step. Free tier: 2,000 calls/month.
              </p>
            </div>
            <SecretInput
              id="brave_search_api_key" label="API Key" value={form.brave_search_api_key}
              onChange={set("brave_search_api_key")} placeholder="BSA..."
              helpUrl="https://api.search.brave.com/app/keys"
              helpLabel="Get from Brave"
            />
          </section>

          {/* Scan settings */}
          <section className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
            <h2 className="font-semibold text-white">Scan Settings</h2>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label className="text-gray-300">Window (days)</Label>
                <Input type="number" min={7} max={365} value={form.scan_window_days}
                  onChange={(e) => set("scan_window_days")(parseInt(e.target.value))}
                  className="bg-gray-900 border-gray-700 text-white" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-gray-300">Min upvotes</Label>
                <Input type="number" min={0} value={form.min_score}
                  onChange={(e) => set("min_score")(parseInt(e.target.value))}
                  className="bg-gray-900 border-gray-700 text-white" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-gray-300">Min comments</Label>
                <Input type="number" min={0} value={form.min_comments}
                  onChange={(e) => set("min_comments")(parseInt(e.target.value))}
                  className="bg-gray-900 border-gray-700 text-white" />
              </div>
            </div>
          </section>

          <Button type="submit" disabled={saving}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white" size="lg">
            {saving ? "Saving…" : "Save Settings"}
          </Button>
        </form>
      </main>
    </div>
  );
}
