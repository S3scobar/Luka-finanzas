<script>
	import { resolveIconClass } from '#lib/icons.js';

	/** @type {{ groups: { label?: string, icons: string[] }[], value: string }} */
	let { groups, value = $bindable() } = $props();
	const current = $derived(resolveIconClass(value));
</script>

<div class="icon-picker" role="radiogroup" aria-label="Icono">
	{#each groups as g, i (i)}
		<div class="icon-group">
			{#if g.label}<span class="icon-group-label">{g.label}</span>{/if}
			<div class="icon-picker-grid">
				{#each g.icons as icon (icon)}
					{@const on = resolveIconClass(icon) === current}
					<button type="button" role="radio" aria-checked={on} class="icon-choice" class:selected={on} aria-label={icon.replace(/^(ph|fa)-/, '').replaceAll('-', ' ')} onclick={() => (value = icon)}>
						<i class={resolveIconClass(icon)} aria-hidden="true"></i>
					</button>
				{/each}
			</div>
		</div>
	{/each}
</div>
