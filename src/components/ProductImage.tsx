import { ImageOff } from "lucide-react";

export default function ProductImage({ src, alt, className = "" }: { src?: string | null; alt: string; className?: string }) {
  if (!src) {
    return (
      <div className={`flex aspect-[4/5] w-full items-center justify-center rounded-xl border border-border bg-gradient-to-br from-muted to-secondary ${className}`}>
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <ImageOff className="h-8 w-8 opacity-50" />
          <span className="text-xs uppercase tracking-widest">Image pending</span>
        </div>
      </div>
    );
  }
  return (
    <div className={`overflow-hidden rounded-xl border border-border bg-muted ${className}`}>
      <img src={src} alt={alt} loading="lazy" className="h-full w-full object-cover" />
    </div>
  );
}
