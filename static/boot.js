// Se ejecuta antes de pintar (bloqueante a propósito): tema guardado y pantalla de apertura.
// Es un archivo aparte y no un <script> en línea para que la CSP no necesite 'unsafe-inline'.
(function () {
  var root = document.documentElement;
  try {
    var t = localStorage.getItem("luka_theme");
    if (t !== "dark" && t !== "light") {
      t = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    root.setAttribute("data-theme", t);
    if (t === "dark") document.querySelector('meta[name="theme-color"]').setAttribute("content", "#0B1220");
  } catch (e) {}

  // Apertura: una vez por sesión del navegador, nunca con "reducir movimiento" ni en páginas legales
  try {
    if (/^\/(privacidad|terminos)/.test(location.pathname)) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches || sessionStorage.getItem("luka_splash")) return;
    sessionStorage.setItem("luka_splash", "1");
  } catch (e) {}
  root.classList.add("splash-on");
})();
