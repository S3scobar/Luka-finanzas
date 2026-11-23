// js/currencyFormatter.js

// Extrae el número puro para guardar en Supabase sin puntos ni comas
export function parseCurrencyInput(value) {
  if (!value) return 0;
  const raw = String(value).replace(/\D/g, "");
  return parseFloat(raw) || 0;
}
// Para oninput en Svelte: deja el campo con separador de miles mientras se escribe
export function formatMoneyInput(e) {
  const raw = e.currentTarget.value.replace(/\D/g, "");
  e.currentTarget.value = raw ? Number(raw).toLocaleString("es-CO") : "";
}
