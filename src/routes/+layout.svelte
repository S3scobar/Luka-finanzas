<script>
	import '@phosphor-icons/web/regular';
	import '@phosphor-icons/web/bold';
	import '@phosphor-icons/web/duotone';
	import '@fortawesome/fontawesome-free/css/all.min.css';
	import '#lib/styles/main.css';
	import '#lib/styles/components.css';
	import '#lib/styles/views.css';
	import '#lib/styles/glass.css';
	import '#lib/styles/splash.css';
	import '#lib/styles/liquid.css';
	import '#lib/styles/app.css';
	import '#lib/styles/desktop.css';
	import '#lib/styles/polish.css';

	import { onMount, tick } from 'svelte';
	import { afterNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import { session } from '#lib/session.svelte.js';
	import { TABS } from '#lib/tabs.js';
	import { shortcuts, loadShortcuts, saveShortcuts, MAX_SHORTCUTS, DEFAULT_SHORTCUTS } from '#lib/shortcuts.svelte.js';
	import Splash from '#lib/ui/Splash.svelte';
	import Footer from '#lib/ui/Footer.svelte';

	let { children } = $props();
	let nav, themeBtn;
	let liquidNav = null;
	let controller = null;
	const loggedIn = $derived(session.status === 'app');

	onMount(async () => {
		const [{ themeManager }, { glassLight }, nav_, { installPrompt }] = await Promise.all([
			import('#lib/themeManager.js'),
			import('#lib/components/glassLight.js'),
			import('#lib/components/liquidNav.js'),
			import('#lib/components/installPrompt.js')
		]);
		themeManager.init(themeBtn);
		glassLight.init();
		installPrompt.init();
		liquidNav = nav_.liquidNav;
		liquidNav.init(nav);
		liquidNav.update({ animate: false });

		// Los modales brotan desde el punto donde se tocó (glass.css define la animación)
		let lastPointer = null;
		document.addEventListener('pointerdown', (e) => {
			lastPointer = { x: e.clientX, y: e.clientY, time: Date.now() };
		}, { capture: true, passive: true });
		new MutationObserver((mutations) => {
			if (!lastPointer || Date.now() - lastPointer.time > 1500) return;
			for (const m of mutations) {
				for (const node of m.addedNodes) {
					const panel = node.nodeType === 1 && node.classList.contains('modal-backdrop') && node.querySelector('.modal-content');
					if (!panel) continue;
					const box = panel.getBoundingClientRect();
					const x = Math.max(0, Math.min(box.width, lastPointer.x - box.left));
					const y = Math.max(0, Math.min(box.height, lastPointer.y - box.top));
					panel.style.transformOrigin = `${x}px ${y}px`;
				}
			}
		}).observe(document.body, { childList: true });
	});

	// La sesión solo arranca en las rutas de la app: las páginas legales se leen sin iniciar sesión
	$effect(() => {
		if (page.route.id?.startsWith('/(app)') && !controller) {
			controller = import('#lib/appController.js').then((m) => (m.startApp(), m));
		}
	});

	// La píldora líquida sigue a la pestaña activa, también cuando la barra aparece tras iniciar sesión
	$effect(() => {
		if (!loggedIn) return;
		tick().then(() => liquidNav?.update({ animate: false }));
	});

	afterNavigate(() => {
		liquidNav?.update();
		// En móvil la barra se desplaza: la pestaña activa debe quedar a la vista
		nav?.querySelector('.active')?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
	});

	const logout = async () => (await controller)?.logout();

	// El perfil se descarga la primera vez que se abre
	let Profile = $state(null);
	let profile = $state(null);
	async function openProfile() {
		if (profile) return profile.open();
		Profile = (await import('#lib/ui/ProfileSheet.svelte')).default;
	}
	const startTour = async () => (await controller)?.startTour();

	// En el celular: los atajos que eligió cada persona van abajo y el resto en «Más»
	$effect(() => {
		if (session.userId) loadShortcuts(session.userId);
	});
	const barTabs = $derived(TABS.filter((t) => shortcuts.keys.includes(t.key)));
	const moreTabs = $derived(TABS.filter((t) => !shortcuts.keys.includes(t.key)));
	const inMore = $derived(moreTabs.some((t) => t.path === page.url.pathname));
	let moreSheet = $state();
	let editing = $state(false);
	let draft = $state([]);
	afterNavigate(() => moreSheet?.close?.());

	function startEdit() {
		draft = [...shortcuts.keys];
		editing = true;
	}
	function toggleDraft(key) {
		if (draft.includes(key)) {
			if (draft.length > 1) draft = draft.filter((k) => k !== key);
		} else if (draft.length < MAX_SHORTCUTS) {
			draft = [...draft, key];
		}
	}
	function saveEdit() {
		saveShortcuts(session.userId, draft);
		editing = false;
	}
	const isDefault = $derived(draft.length === DEFAULT_SHORTCUTS.length && DEFAULT_SHORTCUTS.every((k) => draft.includes(k)));
</script>

<a class="skip-link" href="#main">Saltar al contenido</a>
<Splash />

<header class="navbar">
	<a class="brand" href="/" aria-label="LUKA, inicio">
		<img src="/favicon.svg" alt="" width="22" height="22" /> LUKA
	</a>

	<!-- Las pestañas se deslizan en horizontal en pantallas pequeñas -->
	<nav id="nav-tabs" class="nav-links" aria-label="Secciones" bind:this={nav} hidden={!loggedIn}>
		{#each TABS as t (t.key)}
			{@const active = page.url.pathname === t.path}
			<a class="nav-item-btn" class:active href={t.path} data-tab={t.key} aria-current={active ? 'page' : undefined}>
				<i class="ph-bold {t.icon}" aria-hidden="true"></i> {t.label}
			</a>
		{/each}
	</nav>

	<!-- Sin bloques condicionales aquí: el centro de notificaciones inserta su campana junto al tema -->
	<div class="nav-actions">
		<button bind:this={themeBtn} id="btn-theme" class="btn-theme-icon" type="button" title="Cambiar a modo oscuro" aria-label="Cambiar a modo oscuro" aria-pressed="false">
			<i class="ph-bold ph-moon-stars" aria-hidden="true"></i>
		</button>
		<div id="user-menu" class="user-menu-box" hidden={!loggedIn}>
			<button id="btn-profile" class="btn-theme-icon btn-profile" type="button" title="Mi perfil" aria-label="Mi perfil de {session.name}" aria-haspopup="dialog" onclick={openProfile}>
				<i class="ph-bold ph-user-circle" aria-hidden="true"></i>
			</button>
		</div>
	</div>
</header>

{#if Profile && loggedIn}<Profile bind:this={profile} onlogout={logout} />{/if}

<main id="main" class="container" tabindex="-1">
	{@render children()}
</main>

<Footer />

<!-- Barra de pestañas del celular (oculta en computador, donde manda la barra lateral) -->
<nav class="tabbar" aria-label="Secciones principales" hidden={!loggedIn} style:--tab-count={barTabs.length + 1}>
	{#each barTabs as t (t.key)}
		{@const active = page.url.pathname === t.path}
		<a class="tabbar-item" class:active href={t.path} aria-current={active ? 'page' : undefined}>
			<i class="{active ? 'ph-duotone' : 'ph-bold'} {t.icon}" aria-hidden="true"></i>
			<span>{t.label}</span>
		</a>
	{/each}
	<button type="button" class="tabbar-item" class:active={inMore} aria-haspopup="dialog" onclick={() => moreSheet?.showModal()}>
		<i class="{inMore ? 'ph-duotone' : 'ph-bold'} ph-dots-three-circle" aria-hidden="true"></i>
		<span>Más</span>
	</button>
</nav>

<dialog bind:this={moreSheet} class="more-sheet" aria-label={editing ? 'Elegir atajos' : 'Más secciones'} closedby="any" onclose={() => (editing = false)}>
	<div class="more-grip" aria-hidden="true"></div>
	{#if editing}
		<div class="more-head">
			<h2>Tus atajos</h2>
			<p id="shortcuts-hint">Elige hasta {MAX_SHORTCUTS} para la barra de abajo. El resto queda en «Más».</p>
		</div>
		<ul role="list" aria-describedby="shortcuts-hint">
			{#each TABS as t (t.key)}
				{@const on = draft.includes(t.key)}
				{@const blocked = !on && draft.length >= MAX_SHORTCUTS}
				<li>
					<button type="button" class="more-link pick" class:on aria-pressed={on} aria-disabled={blocked || (on && draft.length === 1)} onclick={() => toggleDraft(t.key)}>
						<span class="more-icon"><i class="ph-duotone {t.icon}" aria-hidden="true"></i></span>
						<span class="more-label">{t.label}</span>
						<span class="pick-mark" aria-hidden="true">{#if on}<i class="ph-bold ph-check"></i>{/if}</span>
					</button>
				</li>
			{/each}
		</ul>
		<p class="pick-count" aria-live="polite">
			{draft.length} de {MAX_SHORTCUTS}{draft.length >= MAX_SHORTCUTS ? ' · quita uno para cambiarlo' : ''}
		</p>
		<div class="more-actions">
			<button type="button" class="more-close" disabled={isDefault} onclick={() => (draft = [...DEFAULT_SHORTCUTS])}>Restablecer</button>
			<button type="button" class="more-close is-primary" onclick={saveEdit}>Guardar</button>
		</div>
	{:else}
		<ul role="list">
			{#each moreTabs as t (t.key)}
				{@const active = page.url.pathname === t.path}
				<li>
					<a href={t.path} class:active aria-current={active ? 'page' : undefined}>
						<span class="more-icon"><i class="ph-duotone {t.icon}" aria-hidden="true"></i></span>
						<span class="more-label">{t.label}</span>
						<i class="ph-bold ph-caret-right more-caret" aria-hidden="true"></i>
					</a>
				</li>
			{/each}
			<li>
				<button type="button" class="more-link" onclick={startEdit}>
					<span class="more-icon"><i class="ph-duotone ph-squares-four" aria-hidden="true"></i></span>
					<span class="more-label">Elegir atajos</span>
					<i class="ph-bold ph-caret-right more-caret" aria-hidden="true"></i>
				</button>
			</li>
			<li>
				<button type="button" class="more-link" onclick={() => { moreSheet?.close(); startTour(); }}>
					<span class="more-icon"><i class="ph-duotone ph-sparkle" aria-hidden="true"></i></span>
					<span class="more-label">Ver la guía de LUKA</span>
					<i class="ph-bold ph-caret-right more-caret" aria-hidden="true"></i>
				</button>
			</li>
		</ul>
		<form method="dialog"><button class="more-close">Cerrar</button></form>
	{/if}
</dialog>

<button id="btn-start-tutorial" class="tutorial-fab" type="button" title="Ver guía de LUKA" hidden={!loggedIn} onclick={startTour}>
	<i class="ph-duotone ph-sparkle" aria-hidden="true"></i>
	<span>Tutorial</span>
</button>
