// js/components/notificationCenter.js
// Avisos: banner en Inicio y notificaciones del sistema (barra de notificaciones del celular)
// Estilo Apple Liquid Glass: sutil, no invasivo, con respuesta táctil y cierre limpio.

import { notificationService } from "../services/notificationService.js";
import { escapeHtml } from "../utils.js";

export const notificationCenter = {
  notifications: [],
  onNavigateTab: null,

  init({ onNavigateTab }) {
    this.onNavigateTab = onNavigateTab;
    this.refresh();
    this.checkPermissionModal();

    // Re-evaluar cada 5 minutos o cuando la ventana vuelve al primer plano
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        this.refresh();
        this.checkPermissionModal();
      }
    });

    setInterval(() => {
      this.refresh();
    }, 5 * 60 * 1000);
  },

  async refresh() {
    try {
      this.notifications = await notificationService.checkAll();
      this.renderBannerIfEligible();
      notificationService.notifySystem(this.notifications);
    } catch (e) {
      console.warn("Error refreshing notifications:", e);
    }
  },

  // Banner llamativo pero no invasivo en Inicio (solo si hay alertas prioritarias)
  renderBannerIfEligible() {
    const existing = document.getElementById("luka-inapp-alert-banner");
    
    // Solo mostrar el banner si hay al menos una notificación de tipo warning o danger
    const priorityItem = this.notifications.find(n => n.severity === "danger") || this.notifications[0];
    if (!priorityItem) {
      if (existing) existing.remove();
      return;
    }

    // Insertar en la vista de Inicio si el usuario está ahí
    const targetParent = document.querySelector(".dashboard-module") || document.getElementById("app");
    if (!targetParent) return;

    if (!existing) {
      const banner = document.createElement("div");
      banner.id = "luka-inapp-alert-banner";
      banner.className = `luka-alert-banner alert-${priorityItem.severity}`;
      this.populateBanner(banner, priorityItem);
      targetParent.prepend(banner);
    } else {
      existing.className = `luka-alert-banner alert-${priorityItem.severity}`;
      this.populateBanner(existing, priorityItem);
    }
  },

  populateBanner(el, item) {
    el.innerHTML = `
      <div class="alert-banner-icon">
        <i class="${escapeHtml(item.icon)}"></i>
      </div>
      <div class="alert-banner-body">
        <strong>${escapeHtml(item.title)}</strong>
        <p>${escapeHtml(item.message)}</p>
      </div>
      <div class="alert-banner-actions">
        ${item.actionTab ? `
          <button type="button" class="btn btn-sm btn-alert-action" data-tab="${escapeHtml(item.actionTab)}">
            ${escapeHtml(item.actionLabel || "Ver")}
          </button>
        ` : ""}
        <button type="button" class="btn-alert-dismiss" title="Descartar por hoy" aria-label="Descartar">
          <i class="ph-bold ph-x"></i>
        </button>
      </div>
    `;

    const actionBtn = el.querySelector(".btn-alert-action");
    if (actionBtn) {
      actionBtn.addEventListener("click", () => {
        if (this.onNavigateTab && item.actionTab) {
          this.onNavigateTab(item.actionTab);
        }
      });
    }

    const dismissBtn = el.querySelector(".btn-alert-dismiss");
    if (dismissBtn) {
      dismissBtn.addEventListener("click", () => {
        notificationService.dismiss(item.id);
        el.style.opacity = "0";
        el.style.transform = "translateY(-6px)";
        setTimeout(() => {
          el.remove();
          this.refresh();
        }, 200);
      });
    }
  },

  checkPermissionModal() {
    if (!("Notification" in window)) return;
    if (Notification.permission === "granted") return;
    if (document.getElementById("notif-permission-modal")) return;

    // Se muestra si aún está en default o no concedido
    // Para no ser invasivo en el mismo instante, usamos un flag de sesión
    const alreadyShownSession = sessionStorage.getItem("luka_notif_modal_shown");
    if (alreadyShownSession) return;
    sessionStorage.setItem("luka_notif_modal_shown", "1");

    setTimeout(() => {
      this.showPermissionModal();
    }, 600);
  },

  showPermissionModal() {
    if (document.getElementById("notif-permission-modal")) return;

    const modal = document.createElement("div");
    modal.id = "notif-permission-modal";
    modal.className = "notif-permission-overlay";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");

    modal.innerHTML = `
      <div class="notif-permission-card">
        <div class="notif-modal-glow"></div>
        <div class="notif-modal-icon-wrap">
          <div class="notif-modal-icon-pulse"></div>
          <i class="ph-duotone ph-bell-ringing"></i>
        </div>
        
        <h3 class="notif-modal-title">Activa las notificaciones</h3>
        <p class="notif-modal-desc">
          Entérate al instante de suscripciones por vencer, cuotas de tarjetas, préstamos pendientes y límites de presupuesto para que nada se te pase.
        </p>

        <div class="notif-modal-features">
          <div class="notif-feature-row">
            <i class="ph-bold ph-calendar-check"></i>
            <span>Vencimiento de suscripciones y servicios</span>
          </div>
          <div class="notif-feature-row">
            <i class="ph-bold ph-credit-card"></i>
            <span>Fechas de corte y pago de tarjetas</span>
          </div>
          <div class="notif-feature-row">
            <i class="ph-bold ph-chart-pie-slice"></i>
            <span>Alertas de presupuesto al 80% o excedido</span>
          </div>
        </div>

        <div class="notif-modal-actions">
          <button type="button" class="btn btn-primary btn-block notif-btn-allow" id="btn-allow-notif">
            <i class="ph-bold ph-bell"></i> Permitir notificaciones
          </button>
          <button type="button" class="btn-link notif-btn-later" id="btn-later-notif">
            Ahora no
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Animación de entrada
    requestAnimationFrame(() => {
      modal.classList.add("is-visible");
    });

    const close = () => {
      modal.classList.remove("is-visible");
      setTimeout(() => modal.remove(), 280);
    };

    modal.querySelector("#btn-allow-notif")?.addEventListener("click", async () => {
      try {
        const granted = await notificationService.requestPushPermission();
        if (granted) {
          this.refresh();
        }
      } finally {
        close();
      }
    });

    modal.querySelector("#btn-later-notif")?.addEventListener("click", () => {
      close();
    });

    modal.addEventListener("click", (e) => {
      if (e.target === modal) close();
    });
  }
};
