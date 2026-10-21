import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/**
 * Staged switch. While false, the portal works exactly as before (no sign-in needed),
 * and signed-in users simply get the extra server-side scoped access.
 * Flip to true only together with supabase/staged/lockdown.sql.
 */
export const AUTH_REQUIRED = false;

export type AppRole = "buyer" | "dsa";

export interface AuthState {
  loading: boolean;
  session: Session | null;
  roles: AppRole[];
  identity: { reviewer: string; store: string } | null;
}

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({ loading: true, session: null, roles: [], identity: null });

  useEffect(() => {
    let alive = true;
    const load = async (session: Session | null) => {
      if (!session) {
        if (alive) setState({ loading: false, session: null, roles: [], identity: null });
        return;
      }
      const [{ data: roles }, { data: ident }] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", session.user.id),
        supabase.from("dsa_identity").select("reviewer, store").eq("user_id", session.user.id).maybeSingle(),
      ]);
      if (alive)
        setState({
          loading: false,
          session,
          roles: (roles ?? []).map((r) => r.role as AppRole),
          identity: ident ?? null,
        });
    };
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setTimeout(() => load(session), 0);
    });
    supabase.auth.getSession().then(({ data }) => load(data.session));
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return state;
}
