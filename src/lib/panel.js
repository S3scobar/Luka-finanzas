// Cálculos del panel de escritorio. Funciones puras: reciben datos ya cargados y devuelven cifras listas para pintar.

const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));

// Los 12 meses que terminan en el mes actual (índice 11 = este mes), con ingreso, gasto y ahorro
export function last12(txs, toBase, now = new Date()) {
  const keys = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
    return { key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, label: MONTHS[d.getMonth()], income: 0, expense: 0, count: 0 };
  });
  const byKey = new Map(keys.map((m) => [m.key, m]));
  for (const t of txs) {
    const m = byKey.get(String(t.transaction_date).slice(0, 7));
    if (!m) continue;
    m[t.type === "income" ? "income" : "expense"] += toBase(t);
    m.count++;
  }
  return keys.map((m) => ({ ...m, net: m.income - m.expense, rate: m.income > 0 ? (m.income - m.expense) / m.income : null }));
}

// Puntaje de 0 a 100 con cuatro hábitos; cada uno suma hasta su peso al llegar a su meta.
// rate: tasa de ahorro (meta 20%), fund: meses de gasto cubiertos por ahorros (meta 6),
// debt: pagos de deuda del mes / ingresos (0% suma todo, 40% o más no suma),
// pace: presupuesto usado / parte del mes transcurrida (1 o menos va al ritmo). Lo que falta no suma ni resta: se reparte.
export function healthScore({ rate, fund, debt, pace }) {
  const parts = [
    rate != null && [35, clamp(rate / 0.2)],
    fund != null && [30, clamp(fund / 6)],
    debt != null && [20, clamp(1 - debt / 0.4)],
    pace != null && [15, clamp(2 - pace)]
  ].filter(Boolean);
  const weight = parts.reduce((s, [w]) => s + w, 0);
  if (!weight) return null;
  const score = Math.round((parts.reduce((s, [w, v]) => s + w * v, 0) / weight) * 100);
  const label = score >= 80 ? "Excelente" : score >= 60 ? "Buena" : score >= 40 ? "Regular" : "En riesgo";
  return { score, label };
}

// Pagos de los próximos `days` días: suscripciones, tarjetas y préstamos, ordenados por fecha
export function upcoming({ subs = [], cc, loans }, today = new Date(), days = 14) {
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const end = new Date(start); end.setDate(end.getDate() + days);
  // Siguiente fecha (hoy incluido) en que cae un día del mes; los meses cortos usan su último día
  const nextDay = (day) => {
    for (let k = 0; k < 2; k++) {
      const y = start.getFullYear(), m = start.getMonth() + k;
      const d = new Date(y, m, Math.min(day, new Date(y, m + 1, 0).getDate()));
      if (d >= start) return d;
    }
  };
  const list = [];
  for (const s of subs) if (s.billing_day) list.push({ date: nextDay(Number(s.billing_day)), name: s.name, amount: Number(s.amount) || 0, kind: "Suscripción", color: s.category?.color });
  if (cc?.totalDue > 0 && cc.earliestDueDay) list.push({ date: nextDay(cc.earliestDueDay), name: "Tarjetas de crédito", amount: cc.totalDue, kind: "Tarjeta", color: "#E11D48" });
  if (loans?.totalDue > 0 && loans.nextDueDate) {
    const [y, m, d] = loans.nextDueDate.split("-").map(Number);
    list.push({ date: new Date(y, m - 1, d), name: "Cuota de préstamo", amount: loans.totalDue, kind: "Préstamo", color: "#F59E0B" });
  }
  return list
    .filter((p) => p.date && p.date <= end)
    .map((p) => ({ ...p, overdue: p.date < start, inDays: Math.round((p.date - start) / 864e5) }))
    .sort((a, b) => a.date - b.date);
}
