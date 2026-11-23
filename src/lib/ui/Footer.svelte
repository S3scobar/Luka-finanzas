<script>
	import { LEGAL } from '#lib/legal.js';
	import { page } from '$app/state';

	const year = new Date().getFullYear();
</script>

<footer class="app-footer">
	<button id="btn-install" class="btn-install" type="button" hidden>
		<i class="ph-duotone ph-arrow-circle-down" aria-hidden="true"></i>
		<span>Instalar app</span>
	</button>

	<nav class="footer-legal" aria-label="Información legal">
		<a href="/privacidad" aria-current={page.url.pathname === '/privacidad' ? 'page' : undefined}>Privacidad</a>
		<a href="/terminos" aria-current={page.url.pathname === '/terminos' ? 'page' : undefined}>Términos</a>
		<a href={LEGAL.license} target="_blank" rel="license noopener noreferrer">Licencia MIT</a>
	</nav>

	<p class="footer-author">© {year} <span>{LEGAL.owner}</span></p>
	<p class="footer-note">Código abierto bajo licencia MIT. El nombre y el logotipo de {LEGAL.app} no se incluyen en la licencia.</p>
</footer>
