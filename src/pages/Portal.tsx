import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { unlockAdmin, isAdminUnlocked } from "@/lib/admin";
import { getLastTab } from "@/lib/last-tab";
import { Lock, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { useEffect } from "react";

export default function Portal() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isAdminUnlocked()) {
      const last = getLastTab();
      navigate(last ?? "/manager", { replace: true });
    }
  }, [navigate]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setTimeout(() => {
      if (unlockAdmin(password)) {
        const last = getLastTab();
        navigate(last ?? "/manager");
      } else {
        setError("Incorrect password. Please try again.");
        setSubmitting(false);
      }
    }, 250);
  };

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-background via-background to-secondary/40">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(var(--accent)/0.4),transparent_60%)]" />

      <div className="relative mx-auto flex min-h-screen max-w-md flex-col px-6 py-8">
        <Link
          to="/"
          className="inline-flex w-fit items-center gap-1.5 text-xs uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" />
          Back to review
        </Link>

        <div className="flex flex-1 flex-col justify-center">
          <div className="mb-10 text-center">
            <div className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-full border border-border bg-card shadow-soft">
              <Lock className="h-5 w-5" />
            </div>
            <p className="text-2xl" style={{ fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif", fontWeight: 600, letterSpacing: "-0.03em", lineHeight: 1, textRendering: "geometricPrecision" }}>
              A L / N E
            </p>
            <h1 className="mt-3 font-display text-4xl font-medium tracking-tight">
              Management Portal
            </h1>
            <p className="mt-3 text-sm text-muted-foreground">
              Restricted access. For authorized buying leadership only.
            </p>
          </div>

          <form
            onSubmit={submit}
            className="space-y-5 rounded-2xl border border-border bg-card p-7 shadow-card"
          >
            <div className="space-y-2">
              <Label htmlFor="pw" className="text-xs uppercase tracking-widest text-muted-foreground">
                Access password
              </Label>
              <Input
                id="pw"
                type="password"
                autoFocus
                autoComplete="current-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError(null);
                }}
                placeholder="••••••••••••"
                className="h-12 text-base tracking-widest"
                required
              />
              {error && <p className="text-xs text-destructive">{error}</p>}
            </div>

            <Button
              type="submit"
              disabled={submitting || !password}
              className="h-12 w-full text-base"
              size="lg"
            >
              {submitting ? "Verifying…" : "Enter Portal"}
            </Button>

            <p className="pt-1 text-center text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Secured · Internal Use Only
            </p>
          </form>
        </div>

        <p className="text-center text-[10px] uppercase tracking-[0.2em] text-muted-foreground/60">
          A L / N E · Buying Review System
        </p>
      </div>
    </div>
  );
}
