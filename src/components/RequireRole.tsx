import { ReactNode, useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { AUTH_REQUIRED, useAuth, type AppRole } from "@/lib/auth";
import { getSession, setSession } from "@/lib/session";

export default function RequireRole({ role, children }: { role: AppRole; children: ReactNode }) {
  const auth = useAuth();
  const location = useLocation();

  // DSA accounts are tied to one store; keep the existing local session in sync with it.
  useEffect(() => {
    if (!AUTH_REQUIRED || role !== "dsa" || !auth.identity) return;
    const cur = getSession();
    if (cur?.reviewer !== auth.identity.reviewer || cur?.store !== auth.identity.store) {
      setSession({ reviewer: auth.identity.reviewer, store: auth.identity.store });
    }
  }, [auth.identity, role]);

  if (!AUTH_REQUIRED) return <>{children}</>;
  if (auth.loading) return <div className="p-10 text-center text-sm text-muted-foreground">Checking access…</div>;
  if (!auth.session) return <Navigate to={`/signin?next=${encodeURIComponent(location.pathname)}`} replace />;
  // Buyers may open the DSA view (they can already see every store's reviews).
  const ok = auth.roles.includes("buyer") || (role === "dsa" && auth.roles.includes("dsa") && !!auth.identity);
  if (!ok)
    return (
      <div className="mx-auto max-w-md p-10 text-center text-sm text-muted-foreground">
        Your account is signed in but ({auth.session.user.email}) has not been approved. Ask the buying office to approve this exact email, or sign in with an approved one.
      </div>
    );
  return <>{children}</>;
}
