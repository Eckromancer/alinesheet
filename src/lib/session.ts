import { useEffect, useState } from "react";

const KEY = "alne-reviewer";

export interface ReviewerSession {
  reviewer: string;
  store: string;
}

export function getSession(): ReviewerSession | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setSession(s: ReviewerSession | null) {
  if (s) localStorage.setItem(KEY, JSON.stringify(s));
  else localStorage.removeItem(KEY);
  window.dispatchEvent(new Event("sc-session"));
}

export function useSession() {
  const [session, setS] = useState<ReviewerSession | null>(() => getSession());
  useEffect(() => {
    const h = () => setS(getSession());
    window.addEventListener("sc-session", h);
    window.addEventListener("storage", h);
    return () => {
      window.removeEventListener("sc-session", h);
      window.removeEventListener("storage", h);
    };
  }, []);
  return session;
}
