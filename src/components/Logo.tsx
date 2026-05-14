import { cn } from "@/lib/utils";

interface Props {
  className?: string;
}

/**
 * Pixel-locked logo — explicit inline styles override any Tailwind ambiguity
 * and remove system-ui from the font stack to prevent iOS / desktop rendering drift.
 */
export default function Logo({ className }: Props) {
  return (
    <span
      className={cn("inline-flex items-center", className)}
      style={{
        fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
        fontSize: "1.5rem",
        fontWeight: 600,
        letterSpacing: "-0.03em",
        lineHeight: 1,
        color: "inherit",
        WebkitFontSmoothing: "antialiased",
        MozOsxFontSmoothing: "grayscale",
        textRendering: "geometricPrecision",
        whiteSpace: "nowrap",
      }}
    >
      A L / N E
    </span>
  );
}
