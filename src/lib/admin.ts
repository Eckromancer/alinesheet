const KEY = "alne-admin-unlocked";
// Internal-tool password gate. Change here to rotate.
export const ADMIN_PASSWORD = "Manager123$";

export function isAdminUnlocked(): boolean {
  try {
    return sessionStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function unlockAdmin(password: string): boolean {
  if (password !== ADMIN_PASSWORD) return false;
  sessionStorage.setItem(KEY, "1");
  return true;
}

export function lockAdmin() {
  sessionStorage.removeItem(KEY);
}
