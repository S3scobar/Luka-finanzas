<script>
	import LegacyView from './LegacyView.svelte';
	import { loadView } from '#lib/views.js';
	import { TABS } from '#lib/tabs.js';

	let { key } = $props();
	const label = TABS.find((t) => t.key === key)?.label;
</script>

<svelte:head><title>{label} · LUKA</title></svelte:head>

<h1 class="sr-only">{label}</h1>
<LegacyView render={async (host) => (await loadView(key)).render(host)} />
