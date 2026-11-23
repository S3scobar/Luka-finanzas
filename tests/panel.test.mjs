// Panel de escritorio: 12 meses, puntaje de salud y próximos pagos.
import test from "node:test";
import assert from "node:assert/strict";
import { last12, healthScore, upcoming } from "../src/lib/panel.js";

const id = (t) => Number(t.amount);
const tx = (date, amount, type = "expense") => ({ transaction_date: date, amount, type });

test("12 meses: cruza el año y deja fuera lo viejo", () => {
  const m = last12([tx("2026-11-03", 100), tx("2026-11-04", 400, "income"), tx("2025-12-01", 50), tx("2025-11-30", 999)], id, new Date(2026, 10, 23));
  assert.equal(m.length, 12);
  assert.equal(m[0].label, "Dic");
  assert.equal(m[0].expense, 50);
  assert.deepEqual([m[11].income, m[11].expense, m[11].net, m[11].rate], [400, 100, 300, 0.75]);
  assert.equal(m[5].rate, null);
});

test("salud: metas cumplidas dan 100 y lo que falta no castiga", () => {
  assert.equal(healthScore({ rate: 0.3, fund: 8, debt: 0, pace: 0.8 }).score, 100);
  assert.equal(healthScore({ rate: 0.1, fund: null, debt: null, pace: null }).score, 50);
  assert.equal(healthScore({ rate: -0.5, fund: 0, debt: 0.6, pace: 3 }).label, "En riesgo");
  assert.equal(healthScore({}), null);
});

test("próximos pagos: ordenados, dentro de la ventana y con meses cortos", () => {
  const p = upcoming({
    subs: [{ name: "Netflix", amount: 38900, billing_day: 3 }, { name: "Gym", amount: 1, billing_day: 20 }, { name: "Fin de mes", amount: 2, billing_day: 31 }],
    cc: { totalDue: 108314, earliestDueDay: 30 },
    loans: { totalDue: 50000, nextDueDate: "2026-11-20" }
  }, new Date(2026, 10, 23));
  assert.deepEqual(p.map((x) => x.name), ["Cuota de préstamo", "Fin de mes", "Tarjetas de crédito", "Netflix"]);
  assert.equal(p[0].overdue, true);
  assert.equal(p[1].date.getDate(), 30); // noviembre no tiene día 31
  assert.equal(p[3].inDays, 10);
});
