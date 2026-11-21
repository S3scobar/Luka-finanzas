// js/views/converterView.js — conversor de moneda y moneda base de la cuenta
import { getRates, getBaseCurrency, setBaseCurrency, convert, formatMoney, currencyOptionsHtml, CURRENCIES } from "../services/currencyService.js";
import { attachCurrencyInput, parseCurrencyInput } from "../currencyFormatter.js";
import { escapeHtml, resolveContainer, notifyError } from "../utils.js";
import { skeletonHtml } from "../components/skeleton.js";

const SOURCE_NOTE = {
  live: "Tasas actualizadas ahora.",
  cache: "Tasas guardadas en tu dispositivo (se renuevan cada 6 horas).",
  fallback: "Sin conexión: se usan tasas aproximadas. Conéctate para ver las reales."
};

export const converterView = {
  from: "USD",
  to: "COP",
  amount: 1,

  resetState() {
    this.from = "USD";
    this.to = "COP";
    this.amount = 1;
  },

  async render(target) {
    const container = resolveContainer(target);
    container.innerHTML = skeletonHtml();

    try {
      const [{ rates, updatedAt, source }, baseCurrency] = await Promise.all([getRates(), getBaseCurrency()]);
      const codes = Object.keys(CURRENCIES);
      // Se omite el COP como origen: 1 peso en dólares o euros daría 0,00
      const pairs = codes.filter(a => a !== "COP").flatMap(a => codes.filter(b => b !== a).map(b => [a, b]));

      container.innerHTML = `
        <div class="converter-module">
          <div class="section-card">
            <div class="section-header">
              <div>
                <h3><i class="ph-duotone ph-currency-circle-dollar"></i> Conversor de moneda</h3>
                <p>${SOURCE_NOTE[source]}${updatedAt ? ` Datos del ${new Date(updatedAt).toLocaleDateString("es-CO", { day: "numeric", month: "short" })}.` : ""}</p>
              </div>
            </div>

            <div class="form-group">
              <label for="fx-amount">Monto</label>
              <input type="text" id="fx-amount" value="${this.amount}" />
            </div>
            <div class="converter-row">
              <select id="fx-from" aria-label="De">${currencyOptionsHtml(this.from, true)}</select>
              <button type="button" id="fx-swap" class="btn btn-secondary btn-sm" aria-label="Invertir monedas"><i class="ph-bold ph-arrows-left-right"></i></button>
              <select id="fx-to" aria-label="A">${currencyOptionsHtml(this.to, true)}</select>
            </div>
            <div class="converter-result" id="fx-result" aria-live="polite"></div>
          </div>

          <div class="section-card">
            <div class="section-header">
              <div>
                <h3><i class="ph-duotone ph-chart-line-up"></i> Tasas de hoy</h3>
              </div>
            </div>
            <div class="converter-rates">
              ${pairs.map(([a, b]) => `
                <div class="converter-rate"><span>1 ${a}</span><strong>${formatMoney(convert(1, a, b, rates), b)}</strong></div>
              `).join("")}
            </div>
          </div>

          <div class="section-card">
            <div class="section-header">
              <div>
                <h3><i class="ph-duotone ph-coins"></i> Moneda base</h3>
                <p>Tus totales (saldo, ingresos y gastos) se muestran en esta moneda, aunque tengas cuentas en otras.</p>
              </div>
            </div>
            <select id="fx-base" aria-label="Moneda base">${currencyOptionsHtml(baseCurrency)}</select>
          </div>
        </div>
      `;

      const amountInput = container.querySelector("#fx-amount");
      const fromSel = container.querySelector("#fx-from");
      const toSel = container.querySelector("#fx-to");
      const result = container.querySelector("#fx-result");

      const update = () => {
        this.amount = parseCurrencyInput(amountInput.value);
        this.from = fromSel.value;
        this.to = toSel.value;
        const out = convert(this.amount, this.from, this.to, rates);
        result.innerHTML = `
          <span class="converter-from">${escapeHtml(formatMoney(this.amount, this.from))} =</span>
          <span class="converter-to">${escapeHtml(formatMoney(out, this.to))}</span>`;
      };

      attachCurrencyInput(amountInput, update);
      fromSel.addEventListener("change", update);
      toSel.addEventListener("change", update);
      container.querySelector("#fx-swap").addEventListener("click", () => {
        [fromSel.value, toSel.value] = [toSel.value, fromSel.value];
        update();
      });
      container.querySelector("#fx-base").addEventListener("change", async (e) => {
        try {
          await setBaseCurrency(e.target.value);
        } catch (err) {
          notifyError(err);
        }
      });
      update();
    } catch (err) {
      container.innerHTML = `<div class="alert-error">Error al cargar el conversor: ${escapeHtml(err.message)}</div>`;
    }
  }
};
