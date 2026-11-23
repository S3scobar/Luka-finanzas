// Cálculos de Ahorros. Funciones puras: sin red ni DOM, para poder probarlas.

const monthKey = (d) => d.getFullYear() * 12 + d.getMonth();

// Meses seguidos con al menos un aporte. Si este mes aún no hay aporte, la racha sigue viva desde el mes pasado.
export function savingStreak(dates, now = new Date()) {
  const months = new Set(dates.map((s) => { const [y, m] = String(s).split("-").map(Number); return y * 12 + m - 1; }));
  const thisMonth = monthKey(now);
  let k = months.has(thisMonth) ? thisMonth : thisMonth - 1;
  let n = 0;
  while (months.has(k)) { n++; k--; }
  return { months: n, savedThisMonth: months.has(thisMonth) };
}

// Cuánto hay que guardar cada mes para llegar a la meta en la fecha (contando el mes actual)
export function monthlyNeeded(current, target, targetDate, now = new Date()) {
  const left = target - current;
  if (!targetDate || left <= 0) return null;
  const [y, m] = String(targetDate).split("-").map(Number);
  const months = y * 12 + (m - 1) - monthKey(now) + 1;
  return months > 0 ? { perMonth: Math.ceil(left / months), months } : { perMonth: left, months: 0 };
}

// Rendimiento aproximado de un mes con tasa efectiva anual en porcentaje (13 = 13 % E.A.)
export const monthlyYield = (amount, rateEA) => (rateEA > 0 && amount > 0 ? amount * ((1 + rateEA / 100) ** (1 / 12) - 1) : 0);

// Hito (25, 50, 75 o 100 %) que se cruza al pasar de `before` a `after`; null si no se cruza ninguno
export function crossedMilestone(before, after, target) {
  if (!(target > 0) || after <= before) return null;
  const hit = [100, 75, 50, 25].find((p) => before / target < p / 100 && after / target >= p / 100);
  return hit ?? null;
}
