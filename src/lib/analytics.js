// Cálculos de Análisis. Funciones puras: reciben movimientos y una función que pasa cada monto
// a la moneda base (toBase), así las cuentas en USD o EUR suman bien con las de COP.

const dayOf = (t) => Number(String(t.transaction_date).slice(8, 10));
const sum = (list, toBase) => list.reduce((s, t) => s + toBase(t), 0);
const byType = (txs, type) => txs.filter((t) => t.type === type);

export function summarize(txs, toBase) {
  const income = sum(byType(txs, "income"), toBase);
  const expense = sum(byType(txs, "expense"), toBase);
  const net = income - expense;
  // Tasa de ahorro: la proporción del ingreso que no se gastó
  return { income, expense, net, rate: income > 0 ? net / income : null };
}

// Gasto acumulado al final de cada día del mes (índice 0 = día 1)
export function cumulativeByDay(txs, days, toBase) {
  const perDay = new Array(days).fill(0);
  for (const t of byType(txs, "expense")) {
    const d = dayOf(t);
    if (d >= 1 && d <= days) perDay[d - 1] += toBase(t);
  }
  let run = 0;
  return perDay.map((v) => (run += v));
}

// Categorías de mayor a menor, con su participación en el total
export function byCategory(txs, type, toBase) {
  const map = new Map();
  for (const t of byType(txs, type)) {
    const key = t.category_id || t.category?.name || "none";
    const row = map.get(key) || {
      key,
      name: t.category?.name || (type === "income" ? "Otros ingresos" : "Sin categoría"),
      icon: t.category?.icon || (type === "income" ? "fa-money-bill-wave" : "fa-tag"),
      color: t.category?.color || "#64748B",
      amount: 0,
      count: 0
    };
    row.amount += toBase(t);
    row.count += 1;
    map.set(key, row);
  }
  const total = [...map.values()].reduce((s, r) => s + r.amount, 0);
  return [...map.values()].map((r) => ({ ...r, share: total ? r.amount / total : 0 })).sort((a, b) => b.amount - a.amount);
}

// Promedio de gasto por cada día de la semana (0 = domingo), contando solo los días ya vividos del periodo
export function weekdayPattern(txs, year, month, uptoDay, toBase) {
  const totals = new Array(7).fill(0);
  const occurrences = new Array(7).fill(0);
  for (let d = 1; d <= uptoDay; d++) occurrences[new Date(year, month - 1, d).getDay()]++;
  for (const t of byType(txs, "expense")) {
    const d = dayOf(t);
    if (d <= uptoDay) totals[new Date(year, month - 1, d).getDay()] += toBase(t);
  }
  const avg = totals.map((v, i) => (occurrences[i] ? v / occurrences[i] : 0));
  const overall = totals.reduce((a, b) => a + b, 0) / Math.max(1, uptoDay);
  const peak = avg.indexOf(Math.max(...avg));
  return { avg, peak, ratio: overall ? avg[peak] / overall : 0 };
}

// Gastos hormiga: compras pequeñas que por separado no se notan
export function smallExpenses(txs, threshold, toBase) {
  const small = byType(txs, "expense").filter((t) => toBase(t) <= threshold);
  return { count: small.length, total: sum(small, toBase) };
}

// Si el ritmo diario se mantiene, con cuánto gasto cierra el mes
export const projectMonth = (spent, day, days) => (day > 0 ? (spent / day) * days : 0);

// Ingreso, gasto y ahorro de cada mes del año (índice 0 = enero)
export function monthlyTotals(txs, toBase) {
  const months = Array.from({ length: 12 }, () => ({ income: 0, expense: 0, count: 0 }));
  for (const t of txs) {
    const m = months[Number(String(t.transaction_date).slice(5, 7)) - 1];
    if (!m) continue;
    m[t.type === "income" ? "income" : "expense"] += toBase(t);
    m.count++;
  }
  return months.map((m) => ({ ...m, net: m.income - m.expense }));
}
