import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppShell from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { setSession, getSession } from "@/lib/session";
import { STORES, type StoreEntry } from "@/lib/stores";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import AdminLoginButton from "@/components/AdminLoginButton";

export default function Login() {
  const navigate = useNavigate();
  const existing = getSession();

  const initial = useMemo<StoreEntry | null>(() => {
    if (!existing) return null;
    return STORES.find((s) => s.label === existing.store) ?? null;
  }, [existing]);

  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<StoreEntry | null>(initial);
  const [dsaOverride, setDsaOverride] = useState(
    existing && initial && !initial.dsa ? existing.reviewer : ""
  );

  const effectiveDsa = selected?.dsa ?? dsaOverride.trim();
  const canStart = !!selected && !!effectiveDsa;

  const start = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || !effectiveDsa) return;
    setSession({ reviewer: effectiveDsa, store: selected.label });
    navigate("/review");
  };

  return (
    <AppShell subtitle="Buying Review">
      <div className="mx-auto mt-6 max-w-md">
        <div className="mb-8 text-center">
          <h1 className="font-display text-4xl font-medium tracking-tight">Akris Color Worksheet</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Select your store to begin. All 103 product reviews will be tagged with your store and DSA name for Madison.
          </p>
        </div>

        <form onSubmit={start} className="space-y-5 rounded-2xl border border-border bg-card p-6 shadow-card">
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">Store</Label>
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={open}
                  className="h-12 w-full justify-between text-base font-normal"
                >
                  {selected ? (
                    <span className="truncate text-left">
                      {selected.label}
                      {selected.dsa && (
                        <span className="text-muted-foreground"> · {selected.dsa}</span>
                      )}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Search stores…</span>
                  )}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command
                  filter={(value, search) =>
                    value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0
                  }
                >
                  <CommandInput placeholder="Search by store # or name…" className="h-11" />
                  <CommandList>
                    <CommandEmpty>No store found.</CommandEmpty>
                    <CommandGroup>
                      {STORES.map((s) => (
                        <CommandItem
                          key={s.code}
                          value={`${s.label} ${s.dsa ?? "unassigned"}`}
                          onSelect={() => {
                            setSelected(s);
                            setDsaOverride("");
                            setOpen(false);
                          }}
                          className="flex items-start gap-2 py-3"
                        >
                          <Check
                            className={cn(
                              "mt-1 h-4 w-4 shrink-0",
                              selected?.code === s.code ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <div className="flex flex-col">
                            <span className="text-sm font-medium">{s.label}</span>
                            <span className="text-xs text-muted-foreground">
                              {s.dsa ?? "Unassigned"}
                            </span>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {selected && !selected.dsa && (
            <div className="space-y-2">
              <Label htmlFor="dsa" className="text-xs uppercase tracking-widest text-muted-foreground">
                {selected.code.startsWith("P") ? "Pilot tester name" : "DSA name (unassigned store)"}
              </Label>
              <Input
                id="dsa"
                value={dsaOverride}
                onChange={(e) => setDsaOverride(e.target.value)}
                placeholder={selected.code.startsWith("P") ? "Enter pilot tester name" : "Enter your name"}
                className="h-12 text-base"
                maxLength={120}
                required
              />
            </div>
          )}

          <Button type="submit" disabled={!canStart} className="h-12 w-full text-base" size="lg">
            {existing ? "Continue Draft" : "Start Review"}
          </Button>
        </form>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          <Link to="/admin" className="underline-offset-4 hover:underline">
            Admin · Import worksheet
          </Link>
        </p>
      </div>

      <footer className="mt-16 flex justify-center pb-6">
        <AdminLoginButton />
      </footer>
    </AppShell>
  );
}
