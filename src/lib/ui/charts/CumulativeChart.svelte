<script>
	// Gasto acumulado día a día: este mes (acento) contra el mes anterior (gris) y, en el mes en curso,
	// la proyección punteada hasta fin de mes. Tooltip con cruz que se ajusta al día más cercano.
	let { current, previous = [], today = null, projected = null, fmt, compact } = $props();

	const H = 200, PAD = { l: 48, r: 14, t: 14, b: 26 };
	let w = $state(320);
	let hover = $state(null);

	const days = $derived(current.length);
	const shown = $derived(today ? current.slice(0, today) : current);
	const max = $derived(Math.max(1, ...shown, ...previous, projected ?? 0) * 1.08);
	const x = (i) => PAD.l + (i / Math.max(1, days - 1)) * (w - PAD.l - PAD.r);
	const y = (v) => PAD.t + (1 - v / max) * (H - PAD.t - PAD.b);
	const path = (arr) => arr.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
	// Tres marcas limpias en el eje: 0, la mitad y el máximo redondeado
	const ticks = $derived.by(() => {
		const step = Math.pow(10, Math.floor(Math.log10(max / 2)));
		const top = Math.floor(max / step) * step;
		return [0, top / 2, top];
	});

	function move(e) {
		const box = e.currentTarget.getBoundingClientRect();
		const i = Math.round(((e.clientX - box.left - PAD.l) / (w - PAD.l - PAD.r)) * (days - 1));
		hover = Math.max(0, Math.min(days - 1, i));
	}
	function key(e) {
		const d = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
		if (!d) return;
		e.preventDefault();
		hover = Math.max(0, Math.min(days - 1, (hover ?? (today ?? days) - 1) + d));
	}
</script>

<div class="viz" bind:clientWidth={w}>
	<svg
		width={w}
		height={H}
		role="slider"
		aria-label="Gasto acumulado por día. Usa las flechas para recorrer los días"
		aria-valuemin="1"
		aria-valuemax={days}
		aria-valuenow={(hover ?? shown.length - 1) + 1}
		aria-valuetext="Día {(hover ?? shown.length - 1) + 1}: {fmt(current[hover ?? shown.length - 1] ?? 0)} este mes{previous[hover ?? shown.length - 1] != null ? `, ${fmt(previous[hover ?? shown.length - 1])} el mes anterior` : ''}"
		tabindex="0"
		onpointermove={move}
		onpointerleave={() => (hover = null)}
		onkeydown={key}
		onblur={() => (hover = null)}
	>
		{#each ticks as t (t)}
			<line class="viz-grid" x1={PAD.l} x2={w - PAD.r} y1={y(t)} y2={y(t)} />
			<text class="viz-tick" x={PAD.l - 8} y={y(t)} text-anchor="end" dominant-baseline="middle">{compact(t)}</text>
		{/each}
		{#each [1, Math.ceil(days / 2), days] as d (d)}
			<text class="viz-tick" x={x(d - 1)} y={H - 6} text-anchor="middle">{d}</text>
		{/each}

		{#if previous.length}<path class="viz-line is-muted" d={path(previous.slice(0, days))} />{/if}
		{#if projected != null && today && today < days}
			<path class="viz-line is-projection" d="M{x(today - 1)},{y(shown.at(-1))}L{x(days - 1)},{y(projected)}" />
		{/if}
		<path class="viz-line" d={path(shown)} />
		{#if shown.length}<circle class="viz-dot" cx={x(shown.length - 1)} cy={y(shown.at(-1))} r="4.5" />{/if}

		{#if hover != null}
			<line class="viz-cross" x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={H - PAD.b} />
		{/if}
	</svg>

	{#if hover != null}
		<div class="viz-tip" style:left="{Math.min(Math.max(x(hover), 90), w - 90)}px" role="status">
			<strong>Día {hover + 1}</strong>
			{#if hover < shown.length}<span><i class="viz-key"></i>{fmt(current[hover])} <small>este mes</small></span>{/if}
			{#if previous[hover] != null}<span><i class="viz-key is-muted"></i>{fmt(previous[hover])} <small>mes anterior</small></span>{/if}
		</div>
	{/if}
</div>
