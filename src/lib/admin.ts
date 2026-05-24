import { supabase } from "@/integrations/supabase/client";

const KEY = "alne-admin-unlocked";

export function isAdminUnlocked(): boolean {
  try {
    return sessionStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export async function unlockAdmin(password: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.functions.invoke("verify-portal-password", {
      body: { password },
    });
    if (error || !data?.ok) return false;
    sessionStorage.setItem(KEY, "1");
    return true;
  } catch {
    return false;
  }
}

export function lockAdmin() {
  sessionStorage.removeItem(KEY);
}
