// Session helpers for the Data Centre flow.
// The pending connection id is the ONLY piece of state passed between
// connect → syncing → source-settings, per the build contract.

// Keeps the old "bizz-" prefix on purpose: renaming a storage key would lose what was saved under it.
const PENDING_CONNECTION_KEY = "bizz-pending-connection";

export function setPendingConnection(id: string) {
  try {
    sessionStorage.setItem(PENDING_CONNECTION_KEY, id);
  } catch {
    // sessionStorage unavailable — flow falls back to the default id
  }
}

export function getPendingConnection(fallback = "meta-ads"): string {
  try {
    const v = sessionStorage.getItem(PENDING_CONNECTION_KEY);
    return v ?? fallback;
  } catch {
    return fallback;
  }
}
