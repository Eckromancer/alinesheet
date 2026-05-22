import { useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const STORAGE_KEY = "portal_access_email";

export default function EmailGate({ children }: { children: ReactNode }) {
  const [unlocked, setUnlocked] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return Boolean(localStorage.getItem(STORAGE_KEY));
  });
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (unlocked) return;
    document.title = "Access required — Confidential";
  }, [unlocked]);

  if (unlocked) return <>{children}</>;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimmed = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) || trimmed.length > 320) {
      setError("Please enter a valid email address.");
      return;
    }
    setSubmitting(true);
    try {
      const { error: insertError } = await supabase.from("access_log").insert({
        email: trimmed,
        path: window.location.pathname,
        user_agent: navigator.userAgent.slice(0, 500),
      });
      if (insertError) throw insertError;
      localStorage.setItem(STORAGE_KEY, trimmed);
      setUnlocked(true);
    } catch (err) {
      console.error(err);
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-5">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="text-[10px] uppercase tracking-[0.32em] text-muted-foreground">
            Confidential · Pilot Access
          </p>
          <h1 className="mt-4 text-2xl font-light tracking-tight">
            A L / N E
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Enter your work email to continue. Access is logged.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Input
            type="email"
            autoFocus
            required
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={submitting}
          />
          {error && (
            <p className="text-xs text-destructive">{error}</p>
          )}
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Verifying…" : "Continue"}
          </Button>
        </form>
        <p className="mt-8 text-center text-[10px] uppercase tracking-[0.22em] text-muted-foreground/70">
          © {new Date().getFullYear()} A L / N E · Proprietary — Not for Distribution
        </p>
      </div>
    </div>
  );
}
