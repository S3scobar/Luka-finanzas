// Controlador de sesión de la app (antes js/main.js). Solo corre en el navegador.
// Decide qué se ve (login, vincular celular o la app) y conecta los componentes globales.
import { goto } from "$app/navigation";
import { session } from "./session.svelte.js";
import { TABS, pathOf, tabIndex } from "./tabs.js";
import { resetViews } from "./views.js";
import { authService } from "./services/authService.js";
import { authView } from "./views/authView.js";
import { resetCurrencyState } from "./services/currencyService.js";
import { tutorialTour } from "./components/tutorialTour.js";
import { swipeNav } from "./components/swipeNav.js";
import { biometricLock } from "./components/biometricLock.js";
import { biometricService } from "./services/biometricService.js";
import { notificationCenter } from "./components/notificationCenter.js";

let started = false;
let activeUserId = null;
let initPromise = null;

const goTab = (key) => {
  const path = pathOf(key);
  if (path) goto(path);
};

function resetAll() {
  resetViews();
  resetCurrencyState();
}

function showAuth() {
  activeUserId = null;
  session.userId = null;
  resetAll();
  session.status = "auth";
  session.authRender = (host) => authView.render(host, () => initApp());
}

async function bootstrap() {
  try {
    const user = await authService.getCurrentUser();
    if (!user) {
      showAuth();
      return;
    }

    // Si inició con celular, auto-registrar en user_phones si aún no existía
    if (user.email?.endsWith("@phone.luka.app")) {
      try { await authService.linkPhone(user.email.split("@")[0], "phone"); } catch {}
    }

    // Regla de seguridad: sin celular vinculado no se entra a la app
    const phoneStatus = await authService.getPhoneStatus();
    if (!phoneStatus.has_phone) {
      activeUserId = null;
      session.userId = null;
      session.status = "phone";
      session.authRender = (host) => authView.renderPhoneLink(host, user, () => initApp());
      return;
    }

    // Esta sesión ya está en pantalla (el evento de login llegó junto con el callback del formulario)
    if (user.id === activeUserId) return;

    const friendlyName = user.user_metadata?.full_name
      || (user.email?.endsWith("@phone.luka.app") ? user.email.split("@")[0] : user.email);
    session.name = friendlyName;

    // Face ID activado: se exige antes de mostrar nada de la cuenta
    if (!(await biometricLock.require(user.id, friendlyName))) {
      biometricService.disable(user.id);
      try { await authService.signOut(); } finally { showAuth(); }
      return;
    }

    // Otro usuario en el mismo navegador no hereda filtros ni selecciones del anterior
    resetAll();
    activeUserId = user.id;
    session.userId = user.id;
    session.status = "app";

    authService.recordActivity();
    notificationCenter.init({ onNavigateTab: goTab });
    biometricLock.offer(user.id, friendlyName);
    tutorialTour.init({ userId: user.id, onSwitchTab: goTab });
  } catch {
    showAuth();
  }
}

// Evita arrancar dos veces a la vez
export function initApp() {
  if (!initPromise) {
    initPromise = bootstrap().finally(() => { initPromise = null; });
  }
  return initPromise;
}

// Se llama la primera vez que se visita una ruta de la app (las páginas legales no la necesitan)
export function startApp() {
  if (started) return;
  started = true;
  initApp();

  const currentKey = () => TABS[tabIndex(location.pathname)]?.key;

  // Deslizar el dedo entre pestañas (solo con sesión iniciada y dentro de la app)
  swipeNav.init({
    getTabs: () => TABS.map((t) => t.key),
    getCurrent: currentKey,
    onChange: goTab,
    isEnabled: () => activeUserId !== null && currentKey() !== undefined
  });

  // Botones dentro de las vistas que llevan a otra pestaña (avisos, notificaciones)
  document.addEventListener("click", (e) => {
    const btn = e.target.closest?.("button[data-tab]");
    if (btn) goTab(btn.dataset.tab);
  });

  // La sesión de Supabase se comparte entre pestañas del navegador: si en otra se cierra
  // la sesión o entra otro usuario, esta debe reflejarlo y no seguir mostrando datos del anterior.
  authService.onAuthStateChanged((user) => {
    if (!user) {
      if (activeUserId !== null) showAuth();
    } else if (user.id !== activeUserId) {
      // Fuera del callback: supabase-js no admite llamadas a su API dentro de este listener
      setTimeout(initApp, 0);
    }
  });

  biometricLock.watchVisibility({
    getUserId: () => activeUserId,
    getName: () => session.name,
    onOtherAccount: async () => {
      biometricService.disable(activeUserId);
      try { await authService.signOut(); } finally { showAuth(); }
    }
  });
}

export async function logout() {
  try {
    if (activeUserId) biometricService.disable(activeUserId); // cerrar sesión también quita el candado
    await authService.signOut();
  } finally {
    showAuth();
  }
}

export function startTour() {
  tutorialTour.start();
}
