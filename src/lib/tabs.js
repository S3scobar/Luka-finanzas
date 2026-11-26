// Pestañas de la app: cada una es una ruta real (enlace directo, botón Atrás del navegador).
export const TABS = [
  { key: "dashboard", path: "/", label: "Inicio", icon: "ph-house-line" },
  { key: "wallets", path: "/billeteras", label: "Billeteras", icon: "ph-wallet" },
  { key: "budgets", path: "/presupuesto", label: "Presupuesto", icon: "ph-chart-pie-slice" },
  { key: "cards", path: "/credito", label: "Crédito", icon: "ph-credit-card" },
  { key: "subs", path: "/suscripciones", label: "Suscripciones", icon: "ph-calendar-check" },
  { key: "savings", path: "/ahorros", label: "Ahorros", icon: "ph-vault" },
  { key: "analytics", path: "/analisis", label: "Análisis", icon: "ph-chart-polar" },
  { key: "converter", path: "/conversor", label: "Conversor", icon: "ph-currency-circle-dollar" }
];

// En el celular, la barra de abajo muestra estas cuatro; las demás van en «Más»
export const PRIMARY_TABS = ["dashboard", "wallets", "cards", "savings"];

// "loans" no es pestaña: abre Crédito directo en préstamos (avisos de cuotas)
export const pathOf = (key) => (key === 'loans' ? '/credito#prestamos' : TABS.find((t) => t.key === key)?.path);
export const tabIndex = (pathname) => TABS.findIndex((t) => t.path === pathname);
