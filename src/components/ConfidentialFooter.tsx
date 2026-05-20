export default function ConfidentialFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-12 border-t border-[hsl(var(--hairline))] py-4 text-center text-[10px] uppercase tracking-[0.22em] text-muted-foreground/70">
      © {year} A L / N E · Confidential — Proprietary &amp; Not for Distribution
    </footer>
  );
}
