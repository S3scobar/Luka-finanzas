<script>
	// Monta una vista heredada (render imperativo sobre un contenedor) dentro de Svelte.
	// Cada montaje crea su propio contenedor: si la respuesta de una vista llega tarde,
	// escribe en un nodo que ya salió del DOM y no pisa la pantalla actual.
	import { onMount } from 'svelte';
	import { skeletonHtml } from '#lib/components/skeleton.js';

	/** @type {{ render: (host: HTMLElement) => unknown }} */
	let { render } = $props();
	let host;
	let mounted = $state(false);

	onMount(() => {
		mounted = true;
		host.innerHTML = skeletonHtml(); // mismo esqueleto que el HTML prerenderizado: sin salto
		render(host);
	});
</script>

<div>
	<!-- El esqueleto viene en el HTML prerenderizado; la vista se pinta en su propio nodo -->
	{#if !mounted}{@html skeletonHtml()}{/if}
	<div bind:this={host}></div>
</div>
