// crypto.randomUUID only exists in secure contexts (https or localhost).
// This fallback keeps the app working when opened from a phone via a LAN address.
export function newId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
