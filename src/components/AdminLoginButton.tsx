import { Link } from "react-router-dom";
import { Lock } from "lucide-react";

export default function AdminLoginButton() {
  return (
    <Link
      to="/portal"
      aria-label="Management Portal"
      className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground/40 transition-colors hover:text-muted-foreground"
    >
      <Lock className="h-3 w-3" />
      Management Portal
    </Link>
  );
}
