// Vistas heredadas (render imperativo) cargadas bajo demanda: cada pestaña es su propio fragmento de JS.
const LOADERS = {
  savings: () => import("./views/savingsView.js").then((m) => m.savingsView),
  analytics: () => import("./views/analyticsView.js").then((m) => m.analyticsView)
};

const loaded = new Map();

export async function loadView(key) {
  const view = await LOADERS[key]();
  loaded.set(key, view);
  return view;
}

// Al cerrar sesión o cambiar de usuario, las vistas ya cargadas olvidan filtros y selecciones
export function resetViews() {
  loaded.forEach((view) => view.resetState?.());
}
