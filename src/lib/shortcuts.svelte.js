// Atajos de la barra de abajo en el celular: cada persona elige hasta 4 pestañas; el resto va en «Más».
// Se guardan en este dispositivo, por usuario (luka_shortcuts_<id>), igual que la guía ya vista.
import { TABS } from "./tabs.js";

export const MAX_SHORTCUTS = 4;
export const DEFAULT_SHORTCUTS = ["dashboard", "wallets", "budgets", "subs"];

const valid = new Set(TABS.map((t) => t.key));
const keyFor = (userId) => `luka_shortcuts_${userId}`;

// Lista limpia: sin claves desconocidas ni repetidas, entre 1 y 4, en el orden de TABS
export function normalize(list) {
  const picked = new Set((Array.isArray(list) ? list : []).filter((k) => valid.has(k)));
  const out = TABS.map((t) => t.key).filter((k) => picked.has(k)).slice(0, MAX_SHORTCUTS);
  return out.length ? out : [...DEFAULT_SHORTCUTS];
}

export const shortcuts = $state({ keys: [...DEFAULT_SHORTCUTS] });

export function loadShortcuts(userId) {
  let saved = null;
  try {
    saved = userId ? JSON.parse(localStorage.getItem(keyFor(userId)) || "null") : null;
  } catch {}
  shortcuts.keys = normalize(saved || DEFAULT_SHORTCUTS);
}

export function saveShortcuts(userId, keys) {
  shortcuts.keys = normalize(keys);
  try {
    if (userId) localStorage.setItem(keyFor(userId), JSON.stringify(shortcuts.keys));
  } catch {
    // sin almacenamiento (modo privado): vale para esta visita
  }
}
