// Cálculos de Análisis: totales, acumulado diario, categorías, día de la semana, gastos hormiga y proyección.
import test from "node:test";
import assert from "node:assert/strict";
import { summarize, cumulativeByDay, byCategory, weekdayPattern, smallExpenses, projectMonth, monthlyTotals } from "../src/lib/analytics.js";

const id = (t) => Number(t.amount);
const tx = (date, amount, type = "expense", category = null) => ({ transaction_date: date, amount, type, category, category_id: category?.name });
const food = { name: "Comida", icon: "fa-utensils", color: "#F59E0B" };
const taxi = { name: "Taxi", icon: "fa-taxi", color: "#3B82F6" };

test("resumen: ahorro y tasa de ahorro", () => {
  const s = summarize([tx("2026-11-01", 1000, "income"), tx("2026-11-02", 250)], id);
  assert.deepEqual(s, { income: 1000, expense: 250, net: 750, rate: 0.75 });
  assert.equal(summarize([tx("2026-11-02", 10)], id).rate, null); // sin ingresos no hay tasa
});

test("acumulado por día ignora ingresos y suma en orden", () => {
  const c = cumulativeByDay([tx("2026-11-01", 10), tx("2026-11-03", 5), tx("2026-11-03", 1, "income")], 4, id);
  assert.deepEqual(c, [10, 10, 15, 15]);
});

test("categorías ordenadas con participación", () => {
  const r = byCategory([tx("2026-11-01", 30, "expense", food), tx("2026-11-02", 10, "expense", taxi), tx("2026-11-03", 60, "expense", food)], "expense", id);
  assert.deepEqual(r.map((x) => [x.name, x.amount, x.share, x.count]), [["Comida", 90, 0.9, 2], ["Taxi", 10, 0.1, 1]]);
});

test("día de la semana: promedio por día vivido y pico", () => {
  // Noviembre 2026: el día 1 es domingo y el 7 es sábado
  const w = weekdayPattern([tx("2026-11-07", 700), tx("2026-11-02", 100)], 2026, 11, 7, id);
  assert.equal(w.peak, 6);
  assert.equal(w.avg[6], 700);
  assert.equal(w.ratio, 700 / (800 / 7)); // 6,125 veces el promedio diario
});

test("gastos hormiga hasta el umbral", () => {
  assert.deepEqual(smallExpenses([tx("2026-11-01", 5000), tx("2026-11-01", 20000), tx("2026-11-01", 20001)], 20000, id), { count: 2, total: 25000 });
});

test("proyección lineal del mes", () => {
  assert.equal(projectMonth(300, 10, 30), 900);
  assert.equal(projectMonth(300, 0, 30), 0);
});

test("totales por mes del año", () => {
  const m = monthlyTotals([tx("2026-01-05", 100, "income"), tx("2026-01-09", 40), tx("2026-03-01", 10)], id);
  assert.deepEqual(m[0], { income: 100, expense: 40, count: 2, net: 60 });
  assert.equal(m[2].net, -10);
  assert.equal(m[1].count, 0);
});
