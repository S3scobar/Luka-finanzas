<script>
	import { QUICK_COLORS } from '#lib/colorSwatches.js';

	let { value = $bindable(), id } = $props();
</script>

<div class="color-row">
	<input type="color" {id} bind:value />
	<div class="color-swatches" role="radiogroup" aria-label="Colores rápidos">
		{#each QUICK_COLORS as c (c)}
			{@const on = c.toLowerCase() === value?.toLowerCase()}
			<button type="button" role="radio" aria-checked={on} class="color-swatch" class:selected={on} style:background-color={c} aria-label="Color {c}" onclick={() => (value = c)}></button>
		{/each}
	</div>
</div>
