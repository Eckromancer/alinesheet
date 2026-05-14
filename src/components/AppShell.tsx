import { Link } from "react-router-dom";
import { ReactNode } from "react";

interface Props {
  children: ReactNode;
  right?: ReactNode;
  subtitle?: string;
}

export default function AppShell({ children, right, subtitle }: Props) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-3">
          <Link to="/" className="flex flex-col leading-tight">
            <span className="font-display text-xl tracking-wide">AKRIS <span className="text-muted-foreground">·</span> NM</span>
            {subtitle && <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{subtitle}</span>}
          </Link>
          <div className="flex items-center gap-2">{right}</div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-5 pb-32 pt-5">{children}</main>
    </div>
  );
}
