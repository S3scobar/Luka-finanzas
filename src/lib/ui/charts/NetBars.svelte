<script>
	// Ahorro neto de cada mes: barras hacia arriba (ahorraste) o hacia abajo (gastaste más de lo que entró).
	// Una sola serie, un solo eje, centrado en cero. Cada barra se puede enfocar con el teclado.
	let { months, labels, fmt, compact } = $props();

	const H = 220, PAD = { l: 48, r: 8, t: 16, b: 26 };
	let w = $state(320);
	let hover = $state(null);

	const hi = $derived(Math.max(0, ...months.map((m) => m.net)));
	const lo = $derived(Math.min(0, ...months.map((m) => m.net)));
	const span = $derived(hi - lo || 1);
	const y = (v) => PAD.t + ((hi - v) / span) * (H - PAD.t - PAD.b);
	const band = $derived(Math.max(0, (w - PAD.l - PAD.r) / 12)); // el ancho puede medir 0 antes del primer pintado
	const bw = $derived(Math.min(24, band * 0.62));
	const cx = (i) => PAD.l + band * i + band / 2;

	// Barra con 4px redondeados solo en el extremo del dato; cuadrada sobre la línea de cero
	function bar(i, v) {
		const x0 = cx(i) - bw / 2, x1 = x0 + bw, base = y(0), end = y(v);
		const r = Math.min(4, Math.abs(base - end) / 2, bw / 2);
		if (Math.abs(base - end) < 0.5) return '';
		const s = v > 0 ? 1 : -1; // el extremo queda arriba si es positivo
		return `M${x0},${base}V${end + s * r}Q${x0},${end} ${x0 + r},${end}H${x1 - r}Q${x1},${end} ${x1},${end + s * r}V${base}Z`;
	}
</script>

<div class="viz" bind:clientWidth={w}>
	<svg width={w} height={H} role="group" aria-label="Ahorro neto por mes">
		{#each [hi, 0, lo].filter((v, i, a) => a.indexOf(v) === i) as t (t)}
			<line class={t === 0 ? 'viz-base' : 'viz-grid'} x1={PAD.l} x2={w - PAD.r} y1={y(t)} y2={y(t)} />
			<text class="viz-tick" x={PAD.l - 8} y={y(t)} text-anchor="end" dominant-baseline="middle">{compact(t)}</text>
		{/each}
		{#each months as m, i (i)}
			<!-- svelte-ignore a11y_no_noninteractive_tabindex (barra enfocable para leer su valor con teclado; la tabla es la alternativa) -->
			<g
				role="img"
				tabindex={m.count ? 0 : -1}
				aria-label="{labels[i]}: {m.count ? `${m.net >= 0 ? 'ahorraste' : 'faltaron'} ${fmt(Math.abs(m.net))}` : 'sin movimientos'}"
				onpointerenter={() => (hover = i)}
				onpointerleave={() => (hover = null)}
				onfocus={() => (hover = i)}
				onblur={() => (hover = null)}
			>
				<rect class="viz-hit" x={cx(i) - band / 2} y={PAD.t} width={band} height={H - PAD.t - PAD.b} />
				<path class="viz-bar" class:is-neg={m.net < 0} class:is-hover={hover === i} d={bar(i, m.net)} />
				<text class="viz-tick" x={cx(i)} y={H - 6} text-anchor="middle">{labels[i][0]}</text>
			</g>
		{/each}
	</svg>
	{#if hover != null}
		{@const m = months[hover]}
		<div class="viz-tip" style:left="{Math.min(Math.max(cx(hover), 90), w - 90)}px" role="status">
			<strong>{m.count ? fmt(m.net) : 'Sin datos'}</strong>
			<span>{labels[hover]}</span>
			{#if m.count}<small>Entró {fmt(m.income)} · salió {fmt(m.expense)}</small>{/if}
		</div>
	{/if}
</div>
