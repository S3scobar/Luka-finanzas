<script>
	// Crédito: tarjetas y préstamos. /credito#prestamos abre directo en préstamos (lo usa Inicio).
	import { afterNavigate } from '$app/navigation';
	import CardsSection from '#lib/ui/credit/CardsSection.svelte';
	import LoansSection from '#lib/ui/credit/LoansSection.svelte';

	const SECTIONS = [
		['cards', 'Tarjetas', 'ph-credit-card'],
		['loans', 'Préstamos', 'ph-handshake']
	];
	let section = $state('cards');
	// También al llegar desde un aviso estando ya en Crédito
	afterNavigate(() => location.hash === '#prestamos' && (section = 'loans'));
</script>

<svelte:head><title>Crédito · LUKA</title></svelte:head>

<div>
	<h1 class="sr-only">Crédito</h1>
	<div class="credit-switch" data-active={section} role="tablist" aria-label="Tipo de crédito">
		<span class="credit-switch-pill" aria-hidden="true"></span>
		{#each SECTIONS as [key, label, icon] (key)}
			<button type="button" role="tab" class="credit-switch-btn" class:active={section === key} aria-selected={section === key} onclick={() => (section = key)}>
				<i class="ph-bold {icon}" aria-hidden="true"></i> {label}
			</button>
		{/each}
	</div>
	<!-- Cada sección se monta sola: una respuesta tardía de la otra no la pisa -->
	{#key section}
		<div class="credit-section">
			{#if section === 'cards'}<CardsSection />{:else}<LoansSection />{/if}
		</div>
	{/key}
</div>
