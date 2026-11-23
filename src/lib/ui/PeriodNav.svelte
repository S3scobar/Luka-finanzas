<script>
	// Selector de mes (Presupuesto; luego Análisis). "Hoy" aparece solo fuera del mes actual.
	const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
	const now = new Date();

	let { year = $bindable(), month = $bindable(), hint = '' } = $props();
	const isNow = $derived(year === now.getFullYear() && month === now.getMonth() + 1);

	function step(delta) {
		const d = new Date(year, month - 1 + delta);
		[year, month] = [d.getFullYear(), d.getMonth() + 1];
	}
</script>

<div class="period-navigator-card">
	<button type="button" class="nav-arrow-btn" aria-label="Mes anterior" onclick={() => step(-1)}><i class="ph-bold ph-caret-left" aria-hidden="true"></i></button>
	<div class="period-current-label">
		<h2 aria-live="polite">{MONTHS[month - 1]} {year}</h2>
		{#if isNow}<small>{hint}</small>
		{:else}<button type="button" class="period-today" onclick={() => ([year, month] = [now.getFullYear(), now.getMonth() + 1])}>Volver a hoy</button>{/if}
	</div>
	<button type="button" class="nav-arrow-btn" aria-label="Mes siguiente" onclick={() => step(1)}><i class="ph-bold ph-caret-right" aria-hidden="true"></i></button>
</div>
