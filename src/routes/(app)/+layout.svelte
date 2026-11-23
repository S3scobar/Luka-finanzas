<script>
	import { beforeNavigate } from '$app/navigation';
	import { session } from '#lib/session.svelte.js';
	import { tabIndex } from '#lib/tabs.js';
	import LegacyView from '#lib/ui/LegacyView.svelte';
	import { skeletonHtml } from '#lib/components/skeleton.js';

	let { children } = $props();
	let dir = $state('');

	// Las pantallas entran desde el lado hacia el que se avanza (glass.css: #app[data-dir])
	beforeNavigate(({ from, to }) => {
		const a = tabIndex(from?.url.pathname ?? ''), b = tabIndex(to?.url.pathname ?? '');
		dir = a < 0 || b < 0 || a === b ? '' : b > a ? 'next' : 'prev';
	});
</script>

<svelte:head>
	{#if session.status === 'auth' || session.status === 'phone'}<title>Ingresar · LUKA</title>{/if}
</svelte:head>

<div id="app" data-dir={dir}>
	{#if session.status === 'app'}
		{@render children()}
	{:else if session.status === 'loading'}
		<div>{@html skeletonHtml()}</div>
	{:else}
		{#key session.authRender}
			<LegacyView render={session.authRender} />
		{/key}
	{/if}
</div>
