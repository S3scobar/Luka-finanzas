// js/services/currencyService.js
// Monedas soportadas, tasas de cambio y moneda base de la cuenta.
import { supabase, requireUserId } from "../supabaseClient.js";

export const CURRENCIES = {
  COP: { name: "Peso colombiano", symbol: "$", locale: "es-CO", digits: 0 },
  USD: { name: "Dólar estadounidense", symbol: "US$", locale: "es-CO", digits: 2 },
  EUR: { name: "Euro", symbol: "€", locale: "es-ES", digits: 2 }
};
export const DEFAULT_CURRENCY = "COP";

const RATES_URL = "https://open.er-api.com/v6/latest/USD";
const CACHE_KEY = "luka_fx_rates";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
// Tasas aproximadas (unidades de cada moneda por 1 USD) para cuando no hay red ni caché.
const FALLBACK_RATES = { USD: 1, COP: 3900, EUR: 0.86 };

let baseCurrency = null;

export const isSupported = (code) => Object.hasOwn(CURRENCIES, code);

// Convierte con tasas expresadas por 1 USD. Un código desconocido se trata como la moneda por defecto.
export function convert(amount, from, to, rates) {
  const n = Number(amount) || 0;
  if (from === to) return n;
  const rf = rates[from] ?? rates[DEFAULT_CURRENCY];
  const rt = rates[to] ?? rates[DEFAULT_CURRENCY];
  return (n / rf) * rt;
}

export function formatMoney(amount, code = DEFAULT_CURRENCY) {
  const c = CURRENCIES[code] || CURRENCIES[DEFAULT_CURRENCY];
  return new Intl.NumberFormat(c.locale, {
    style: "currency",
    currency: isSupported(code) ? code : DEFAULT_CURRENCY,
    minimumFractionDigits: c.digits,
    maximumFractionDigits: c.digits
  }).format(Number(amount) || 0);
}

function readCache() {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY)); } catch { return null; }
}

// Devuelve { rates, updatedAt, source: "live" | "cache" | "fallback" }
export async function getRates() {
  const cached = readCache();
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return { rates: cached.rates, updatedAt: cached.updatedAt, source: "cache" };
  }
  try {
    const res = await fetch(RATES_URL, { signal: AbortSignal.timeout(4000) }); // sin red lenta que bloquee las pantallas
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const rates = { USD: 1, COP: json.rates?.COP, EUR: json.rates?.EUR };
    if (!(rates.COP > 0) || !(rates.EUR > 0)) throw new Error("Respuesta sin tasas");
    const updatedAt = json.time_last_update_unix ? json.time_last_update_unix * 1000 : Date.now();
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ rates, updatedAt, fetchedAt: Date.now() })); } catch { /* sin caché */ }
    return { rates, updatedAt, source: "live" };
  } catch {
    if (cached) return { rates: cached.rates, updatedAt: cached.updatedAt, source: "cache" };
    return { rates: FALLBACK_RATES, updatedAt: null, source: "fallback" };
  }
}

export async function getBaseCurrency() {
  if (baseCurrency) return baseCurrency;
  const userId = await requireUserId();
  // Si el perfil no se puede leer, los totales siguen mostrándose en la moneda por defecto
  try {
    const { data } = await supabase.from("profiles").select("currency").eq("id", userId).maybeSingle();
    baseCurrency = isSupported(data?.currency) ? data.currency : DEFAULT_CURRENCY;
  } catch {
    return DEFAULT_CURRENCY;
  }
  return baseCurrency;
}

export async function setBaseCurrency(code) {
  if (!isSupported(code)) throw new Error("Moneda no soportada");
  const userId = await requireUserId();
  const { error } = await supabase.from("profiles").update({ currency: code }).eq("id", userId);
  if (error) throw error;
  baseCurrency = code;
}

// Al cerrar sesión o cambiar de usuario no debe quedar la moneda del anterior
export function resetCurrencyState() { baseCurrency = null; }

export function currencyOptionsHtml(selected, short = false) {
  return Object.entries(CURRENCIES)
    .map(([code, c]) => `<option value="${code}" ${code === selected ? "selected" : ""}>${short ? code : `${code} · ${c.name}`}</option>`)
    .join("");
}
