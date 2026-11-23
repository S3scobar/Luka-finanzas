// Ahorros: racha, cuota mensual hacia la meta, rendimiento e hitos.
import test from "node:test";
import assert from "node:assert/strict";
import { savingStreak, monthlyNeeded, monthlyYield, crossedMilestone } from "../src/lib/savings.js";

const now = new Date(2026, 10, 23); // 23 nov 2026

test("racha: cuenta meses seguidos y no se rompe si este mes aún no aportas", () => {
  assert.deepEqual(savingStreak(["2026-11-02", "2026-10-15", "2026-09-01", "2026-07-01"], now), { months: 3, savedThisMonth: true });
  assert.deepEqual(savingStreak(["2026-10-15", "2026-09-01"], now), { months: 2, savedThisMonth: false });
  assert.equal(savingStreak(["2026-12-31", "2027-01-01"], new Date(2027, 0, 5)).months, 2); // cruza el año
  assert.equal(savingStreak(["2026-08-01"], now).months, 0);
});

test("cuota mensual: incluye el mes actual y avisa si la fecha ya pasó", () => {
  assert.deepEqual(monthlyNeeded(400000, 1000000, "2027-01-31", now), { perMonth: 200000, months: 3 });
  assert.deepEqual(monthlyNeeded(0, 500000, "2026-10-01", now), { perMonth: 500000, months: 0 });
  assert.equal(monthlyNeeded(1000000, 1000000, "2027-01-31", now), null);
  assert.equal(monthlyNeeded(0, 1000, null, now), null);
});

test("rendimiento mensual de 12% E.A. ≈ 0,949%", () => {
  assert.equal(Math.round(monthlyYield(1000000, 12)), 9489);
  assert.equal(monthlyYield(1000000, 0), 0);
});

test("hitos: solo el mayor que se cruza", () => {
  assert.equal(crossedMilestone(200, 800, 1000), 75);
  assert.equal(crossedMilestone(900, 1000, 1000), 100);
  assert.equal(crossedMilestone(260, 400, 1000), null);
  assert.equal(crossedMilestone(500, 400, 1000), null);
});
