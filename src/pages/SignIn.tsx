import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import AppShell from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Mode = "signin" | "signup" | "forgot";

export default function SignIn() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get("next") || "/";
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const addr = email.trim().toLowerCase();
    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email: addr, password });
      if (error) setMsg(error.message);
      else navigate(next, { replace: true });
    } else if (mode === "signup") {
      const { error } = await supabase.auth.signUp({
        email: addr,
        password,
        options: { emailRedirectTo: window.location.origin },
      });
      setMsg(error ? error.message : "Check your email to confirm your account, then sign in.");
    } else {
      const { error } = await supabase.auth.resetPasswordForEmail(addr, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      setMsg(error ? error.message : "If that email has an account, a reset link is on its way.");
    }
    setBusy(false);
  };

  return (
    <AppShell subtitle="Sign in">
      <form onSubmit={submit} className="mx-auto mt-10 max-w-sm space-y-4 rounded-2xl border border-border bg-card p-6 shadow-card">
        <h1 className="font-display text-2xl">
          {mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : "Reset password"}
        </h1>
        <p className="text-xs text-muted-foreground">Use the work email the buying office approved.</p>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" required maxLength={320} value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        {mode !== "forgot" && (
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
        )}
        {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
        <Button type="submit" className="w-full" disabled={busy}>
          {mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : "Send reset link"}
        </Button>
        <div className="flex justify-between text-xs text-muted-foreground">
          <button type="button" onClick={() => setMode(mode === "signup" ? "signin" : "signup")}>
            {mode === "signup" ? "Have an account? Sign in" : "First time? Create account"}
          </button>
          <button type="button" onClick={() => setMode("forgot")}>Forgot password</button>
        </div>
      </form>
    </AppShell>
  );
}
