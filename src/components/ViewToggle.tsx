import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { isAdminUnlocked, unlockAdmin } from "@/lib/admin";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type View = "dsa" | "buyer";

export default function ViewToggle({ active }: { active: View }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const goDsa = () => {
    if (active === "dsa") return;
    navigate("/");
  };

  const goBuyer = () => {
    if (active === "buyer") return;
    if (isAdminUnlocked()) {
      navigate("/manager");
    } else {
      setOpen(true);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const ok = await unlockAdmin(password);
    if (ok) {
      setOpen(false);
      setPassword("");
      setError(null);
      navigate("/manager");
    } else {
      setError("Incorrect password.");
    }
    setSubmitting(false);
  };

  return (
    <>
      <div
        role="tablist"
        aria-label="Switch dashboard"
        className="inline-flex items-center rounded-full border border-[hsl(var(--hairline))] bg-card p-0.5 shadow-soft"
      >
        <button
          type="button"
          role="tab"
          aria-selected={active === "dsa"}
          onClick={goDsa}
          className={cn(
            "rounded-full px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.2em] transition-colors sm:px-4 sm:text-[11px]",
            active === "dsa"
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          DSA View
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={active === "buyer"}
          onClick={goBuyer}
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.2em] transition-colors sm:px-4 sm:text-[11px]",
            active === "buyer"
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {active !== "buyer" && !isAdminUnlocked() && (
            <Lock className="h-2.5 w-2.5" />
          )}
          Buyer Dashboard
        </button>
      </div>

      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) {
            setPassword("");
            setError(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl tracking-tight">
              Buyer Dashboard
            </DialogTitle>
            <DialogDescription>
              Restricted access. Enter the buyer password to continue.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label
                htmlFor="buyer-pw"
                className="text-xs uppercase tracking-widest text-muted-foreground"
              >
                Password
              </Label>
              <Input
                id="buyer-pw"
                type="password"
                autoFocus
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError(null);
                }}
                placeholder="••••••••••"
                className="h-11 text-base tracking-widest"
                required
              />
              {error && <p className="text-xs text-destructive">{error}</p>}
            </div>
            <Button
              type="submit"
              disabled={submitting || !password}
              className="h-11 w-full"
            >
              {submitting ? "Verifying…" : "Enter Dashboard"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
