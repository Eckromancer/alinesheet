import { ReactNode, useEffect } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { isAdminUnlocked, lockAdmin } from "@/lib/admin";
import { setLastTab } from "@/lib/last-tab";
import { Button } from "@/components/ui/button";
import { ClipboardList, LayoutDashboard, ShieldCheck, FileBarChart, LogOut, Home } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  children: ReactNode;
}

const tabs = [
  { to: "/manager/home", label: "Home", icon: Home, end: true },
  { to: "/", label: "DSA Entry", icon: ClipboardList, end: true },
  { to: "/manager", label: "Buyer Dashboard", icon: LayoutDashboard, end: true },
  { to: "/manager/governance", label: "Governance", icon: ShieldCheck, end: false },
  { to: "/manager/reports", label: "Reports", icon: FileBarChart, end: false },
];

export default function ManagerLayout({ children }: Props) {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!isAdminUnlocked()) navigate("/portal", { replace: true });
  }, [navigate]);

  useEffect(() => {
    setLastTab(location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
          <Link to="/manager" className="flex flex-col leading-tight">
            <span className="font-display text-xl tracking-wide">
              AKRIS <span className="text-muted-foreground">·</span> NM
            </span>
            <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Management Portal
            </span>
          </Link>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              lockAdmin();
              navigate("/portal");
            }}
          >
            <LogOut className="mr-1 h-4 w-4" />
            Sign out
          </Button>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 px-3">
          {tabs.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              className={({ isActive }) =>
                cn(
                  "relative flex items-center gap-1.5 px-3 py-2.5 text-sm transition-colors",
                  isActive
                    ? "text-foreground after:absolute after:inset-x-3 after:bottom-0 after:h-[2px] after:bg-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )
              }
            >
              <t.icon className="h-4 w-4" />
              {t.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-6">{children}</main>
    </div>
  );
}
