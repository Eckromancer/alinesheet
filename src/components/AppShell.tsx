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
      <header className="sticky top-0 z-30 border-b border-[hsl(var(--hairline))] bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3 sm:px-5 sm:py-3.5">
          <Link to="/" className="flex items-center leading-none">
            <span className="font-display text-2xl tracking-tight sm:text-3xl">Style Compass</span>
            {subtitle && (
              <span className="ml-3 hidden text-[10px] uppercase tracking-[0.28em] text-muted-foreground sm:block">
                {subtitle}
              </span>
            )}
          </Link>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">{right}</div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-5 pb-32 pt-5">{children}</main>
    </div>
  );
}
