import { ReactNode, useEffect } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { isAdminUnlocked, lockAdmin } from "@/lib/admin";
import { setLastTab } from "@/lib/last-tab";
import { Button } from "@/components/ui/button";
import { ClipboardList, LayoutDashboard, ShieldCheck, FileBarChart, LogOut, Home } from "lucide-react";
import { cn } from "@/lib/utils";
import ViewToggle from "@/components/ViewToggle";
import Logo from "@/components/Logo";

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
      <header className="sticky top-0 z-30 border-b border-[hsl(var(--hairline))] bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3.5">
          <Link to="/manager" className="flex items-baseline gap-3 leading-none">
            <Logo />
            <span className="hidden text-[10px] uppercase tracking-[0.28em] text-muted-foreground sm:inline">
              Buying Intelligence
            </span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            <ViewToggle active="buyer" />
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
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-3">
          {tabs.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              className={({ isActive }) =>
                cn(
                  "relative flex shrink-0 items-center gap-1.5 px-3 py-2.5 text-[13px] uppercase tracking-[0.18em] transition-colors",
                  isActive
                    ? "text-foreground after:absolute after:inset-x-3 after:bottom-0 after:h-[1.5px] after:bg-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )
              }
            >
              <t.icon className="h-3.5 w-3.5" />
              {t.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-6">{children}</main>
    </div>
  );
}
