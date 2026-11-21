import test from "node:test";
import assert from "node:assert/strict";
import { convert, formatMoney, isSupported } from "../js/services/currencyService.js";

const rates = { USD: 1, COP: 4000, EUR: 0.8 };

test("convierte entre monedas usando USD como pivote", () => {
  assert.equal(convert(1, "USD", "COP", rates), 4000);
  assert.equal(convert(4000, "COP", "USD", rates), 1);
  assert.equal(convert(1, "EUR", "COP", rates), 5000);
});

test("misma moneda no cambia el monto y un monto inválido da 0", () => {
  assert.equal(convert(123.45, "COP", "COP", rates), 123.45);
  assert.equal(convert("abc", "USD", "EUR", rates), 0);
});

test("formatea cada moneda con sus decimales", () => {
  assert.match(formatMoney(1200000, "COP"), /1\.200\.000/);
  assert.match(formatMoney(10.5, "USD"), /10,50/);
  assert.match(formatMoney(10.5, "EUR"), /10,50/);
});

test("solo acepta COP, USD y EUR", () => {
  assert.ok(isSupported("EUR"));
  assert.ok(!isSupported("MXN"));
  assert.ok(!isSupported("toString"));
});
