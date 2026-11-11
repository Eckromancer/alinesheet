/** Same response whether or not the email exists, or the request failed/was rate limited. */
export const GENERIC_RESET_MESSAGE = "If that email belongs to an approved account, a reset link is on its way. Links expire and work once.";

export function normalizeRecoveryEmail(raw: string): string | null {
  const v = raw.trim().toLowerCase();
  if (v.length < 3 || v.length > 320) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? v : null;
}
