const LAST_TAB_KEY = "sc-last-tab";

export function setLastTab(path: string) {
  try {
    localStorage.setItem(LAST_TAB_KEY, path);
  } catch {
    // ignore
  }
}

export function getLastTab(): string | null {
  try {
    return localStorage.getItem(LAST_TAB_KEY);
  } catch {
    return null;
  }
}

export function clearLastTab() {
  try {
    localStorage.removeItem(LAST_TAB_KEY);
  } catch {
    // ignore
  }
}
