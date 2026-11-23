<script>
	// Análisis (antes views/analyticsView.js). Todo se convierte a la moneda base antes de sumar.
	import { transactionService } from '#lib/services/transactionService.js';
	import { getRates, getBaseCurrency, convert, formatMoney } from '#lib/services/currencyService.js';
	import { summarize, cumulativeByDay, byCategory, weekdayPattern, smallExpenses, projectMonth, monthlyTotals } from '#lib/analytics.js';
	import { resolveIconClass } from '#lib/icons.js';
	import { formatShortDate } from '#lib/utils.js';
	import { skeletonHtml } from '#lib/components/skeleton.js';
	import PeriodNav from '#lib/ui/PeriodNav.svelte';
	import CumulativeChart from '#lib/ui/charts/CumulativeChart.svelte';
	import NetBars from '#lib/ui/charts/NetBars.svelte';

	const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
	const WEEK = [1, 2, 3, 4, 5, 6, 0]; // la semana empieza el lunes
	const WEEK_NAMES = ['domingos', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábados'];
	const SMALL = { COP: 20000, USD: 5, EUR: 5 }; // tope de un "gasto hormiga" según la moneda base
	const now = new Date();

	let mode = $state('month');
	let year = $state(now.getFullYear());
	let month = $state(now.getMonth() + 1);
	let kind = $state('expense');
	let openCat = $state(null);
	let d = $state(null);
	let error = $state('');
	let loading = $state(false);

	// Una respuesta tardía (mes anterior que tocaste rápido) no pisa la actual
	let req = 0;
	async function load(m, yr, mo) {
		const mine = ++req;
		loading = true;
		try {
			const prev = new Date(yr, mo - 2);
			const [fx, base, a, b] = await Promise.all([
				getRates(),
				getBaseCurrency(),
				m === 'month' ? transactionService.getTransactions(yr, mo) : transactionService.getYearlyTransactions(yr),
				m === 'month' ? transactionService.getTransactions(prev.getFullYear(), prev.getMonth() + 1) : transactionService.getYearlyTransactions(yr - 1)
			]);
			if (mine !== req) return;
			const toBase = (t) => convert(Number(t.amount), t.wallet?.currency, base, fx.rates);
			d = { mode: m, year: yr, month: mo, base, toBase, cur: a || [], prev: b || [] };
			error = '';
		} catch (err) {
			if (mine === req) error = err?.message || 'Error desconocido';
		} finally {
			if (mine === req) loading = false;
		}
	}
	$effect(() => {
		load(mode, year, month);
	});

	const fmt = (v) => formatMoney(v, d?.base);
	const nf = new Intl.NumberFormat('es-CO', { notation: 'compact', maximumFractionDigits: 1 });
	const compact = (v) => nf.format(v);
	// Montos cortos con su moneda para las cápsulas del año ($ 15,8 M)
	const short = (v) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: d?.base || 'COP', notation: 'compact', maximumFractionDigits: 1 }).format(v);
	const pct = (v) => `${Math.round(v * 100)}%`;
	const change = (a, b) => (b > 0 ? (a - b) / b : null);

	// ---------- Mes ----------
	const m = $derived.by(() => {
		if (!d || d.mode !== 'month') return null;
		const days = new Date(d.year, d.month, 0).getDate();
		const isNow = d.year === now.getFullYear() && d.month === now.getMonth() + 1;
		const upto = isNow ? now.getDate() : days;
		const prevDays = new Date(d.year, d.month - 1, 0).getDate();
		const cum = cumulativeByDay(d.cur, days, d.toBase);
		const prevCum = cumulativeByDay(d.prev, prevDays, d.toBase);
		const s = summarize(d.cur, d.toBase);
		const prevCats = new Map(byCategory(d.prev, kind, d.toBase).map((c) => [c.key, c.amount]));
		const cats = byCategory(d.cur, kind, d.toBase).map((c) => ({ ...c, delta: change(c.amount, prevCats.get(c.key) ?? 0) }));
		return {
			days,
			isNow,
			upto,
			s,
			cum,
			prevCum,
			// Ritmo: lo gastado hasta hoy contra lo gastado hasta el mismo día del mes anterior
			pace: change(cum[upto - 1], prevCum[Math.min(upto, prevDays) - 1]),
			projected: isNow ? projectMonth(cum[upto - 1], upto, days) : null,
			cats,
			top: cats.find((c) => c.delta != null && c.delta > 0.15 && c.amount > s.expense * 0.05),
			week: weekdayPattern(d.cur, d.year, d.month, upto, d.toBase),
			small: smallExpenses(d.cur, SMALL[d.base] ?? SMALL.COP, d.toBase),
			total: kind === 'expense' ? s.expense : s.income
		};
	});
	const weekMax = $derived(m ? Math.max(1, ...m.week.avg) : 1);
	const catTx = (key) => d.cur.filter((t) => t.type === kind && (t.category_id || t.category?.name || 'none') === key).sort((a, b) => d.toBase(b) - d.toBase(a)).slice(0, 5);

	// ---------- Año ----------
	const y = $derived.by(() => {
		if (!d || d.mode !== 'year') return null;
		const months = monthlyTotals(d.cur, d.toBase);
		const s = summarize(d.cur, d.toBase);
		const prev = summarize(d.prev, d.toBase);
		const lived = months.filter((x) => x.count);
		const best = lived.reduce((a, b) => (b.net > (a?.net ?? -Infinity) ? b : a), null);
		const worst = lived.reduce((a, b) => (b.net < (a?.net ?? Infinity) ? b : a), null);
		return {
			months,
			s,
			prev,
			lived: lived.length,
			best: best && months.indexOf(best),
			worst: worst && worst !== best ? months.indexOf(worst) : null,
			cats: byCategory(d.cur, 'expense', d.toBase).slice(0, 6),
			avgExpense: lived.length ? s.expense / lived.length : 0
		};
	});
</script>

<svelte:head><title>Análisis · LUKA</title></svelte:head>

{#snippet delta(v, upIsGood)}
	{#if v != null && Math.abs(v) >= 0.01}
		{@const good = v > 0 === upIsGood}
		<span class="delta" class:is-good={good} class:is-bad={!good}>
			<i class="ph-bold {v > 0 ? 'ph-arrow-up-right' : 'ph-arrow-down-right'}" aria-hidden="true"></i>{pct(Math.abs(v))}
		</span>
	{/if}
{/snippet}

<div>
	<h1 class="sr-only">Análisis</h1>
	<div class="credit-switch analytics-switch" data-active={mode} role="tablist" aria-label="Periodo">
		<span class="credit-switch-pill" aria-hidden="true"></span>
		{#each [['month', 'Mes', 'ph-calendar-blank'], ['year', 'Año', 'ph-chart-bar']] as [key, label, icon] (key)}
			<button type="button" role="tab" class="credit-switch-btn" class:active={mode === key} aria-selected={mode === key} onclick={() => (mode = key)}>
				<i class="ph-bold {icon}" aria-hidden="true"></i> {label}
			</button>
		{/each}
	</div>

	{#if mode === 'month'}
		<PeriodNav bind:year bind:month hint={m ? `${d.cur.length} movimientos` : ''} />
	{:else}
		<div class="period-navigator-card">
			<button type="button" class="nav-arrow-btn" aria-label="Año anterior" onclick={() => year--}><i class="ph-bold ph-caret-left" aria-hidden="true"></i></button>
			<div class="period-current-label"><h2 aria-live="polite">{year}</h2><small>Resumen del año</small></div>
			<button type="button" class="nav-arrow-btn" aria-label="Año siguiente" onclick={() => year++}><i class="ph-bold ph-caret-right" aria-hidden="true"></i></button>
		</div>
	{/if}

	{#if error && !d}
		<div class="alert-error" role="alert">Error al cargar el análisis: {error}</div>
	{:else if !d}
		{@html skeletonHtml()}
	{:else}
		<div class="analytics-module" class:is-loading={loading} aria-busy={loading}>
			{#if m}
				<!-- Lo primero: cuánto quedó del mes, con su tasa de ahorro -->
				<section class="budget-hero-card insight-hero" aria-label="Resultado del mes">
					<span class="budget-hero-badge"><i class="ph-bold ph-piggy-bank" aria-hidden="true"></i> {m.s.net >= 0 ? 'Ahorraste' : 'Gastaste de más'}</span>
					<span class="hero-number" class:text-danger={m.s.net < 0}>{fmt(Math.abs(m.s.net))}</span>
					{#if m.s.rate != null}
						<span class="hero-sub">{m.s.net >= 0 ? `El ${pct(m.s.rate)} de lo que entró` : `${pct(-m.s.rate)} más de lo que entró`}</span>
					{/if}
					<div class="hero-split">
						<div><small>Entró</small><strong class="text-success">{fmt(m.s.income)}</strong></div>
						<div><small>Salió</small><strong>{fmt(m.s.expense)}</strong> {@render delta(m.pace, false)}</div>
					</div>
				</section>

				<!-- Curva de gasto: este mes contra el anterior, día a día -->
				<section class="section-card" aria-labelledby="pace-t">
					<div class="section-header">
						<div>
							<h3 id="pace-t"><i class="ph-duotone ph-chart-line-up" aria-hidden="true"></i> Ritmo de gasto</h3>
							<p>
								{#if m.pace == null}Aún no hay mes anterior para comparar.
								{:else if m.pace <= 0}Al día {m.upto} llevas un <strong>{pct(-m.pace)} menos</strong> que el mes pasado.
								{:else}Al día {m.upto} llevas un <strong>{pct(m.pace)} más</strong> que el mes pasado.{/if}
							</p>
						</div>
					</div>
					<div class="viz-legend">
						<span><i class="viz-key"></i>{MONTHS[d.month - 1]}</span>
						<span><i class="viz-key is-muted"></i>Mes anterior</span>
						{#if m.projected != null && m.upto < m.days}<span><i class="viz-key is-projection"></i>Proyección</span>{/if}
					</div>
					<CumulativeChart current={m.cum} previous={m.prevCum} today={m.isNow ? m.upto : null} projected={m.projected} {fmt} {compact} />
					{#if m.projected != null && m.upto < m.days && m.s.expense > 0}
						<p class="insight-line">
							<i class="ph-duotone ph-target" aria-hidden="true"></i>
							<span>A este ritmo cerrarás {MONTHS[d.month - 1].toLowerCase()} con <strong>≈ {fmt(m.projected)}</strong> en gastos{#if m.s.income > 0}, {m.projected <= m.s.income ? `y te quedarían ≈ ${fmt(m.s.income - m.projected)}` : `≈ ${fmt(m.projected - m.s.income)} más de lo que ha entrado`}{/if}.</span>
						</p>
					{/if}
				</section>

				<!-- Hallazgos: patrones que se ven solo con los datos juntos -->
				{#if m.s.expense > 0}
					<div class="insight-grid">
						{#if m.week.ratio >= 1.3}
							<section class="insight-card" aria-labelledby="wk-t">
								<h3 id="wk-t"><i class="ph-duotone ph-calendar-dots" aria-hidden="true"></i> Tu día más caro</h3>
								<p>Los <strong>{WEEK_NAMES[m.week.peak]}</strong> gastas {m.week.ratio.toFixed(1).replace('.', ',')}× tu promedio diario.</p>
								<div class="week-strip" role="list">
									{#each WEEK as wd (wd)}
										{@const v = m.week.avg[wd] / weekMax}
										<div role="listitem" class="week-cell" class:is-peak={wd === m.week.peak} style:--v={Math.round(12 + v * 88)} aria-label="{WEEK_NAMES[wd]}: {fmt(m.week.avg[wd])} en promedio">
											<span>{'DLMMJVS'[wd]}</span>
										</div>
									{/each}
								</div>
							</section>
						{/if}
						{#if m.small.count >= 5}
							<section class="insight-card" aria-labelledby="sm-t">
								<h3 id="sm-t"><i class="ph-duotone ph-coffee" aria-hidden="true"></i> Gastos hormiga</h3>
								<p><strong>{m.small.count} compras pequeñas</strong> suman {fmt(m.small.total)}: el {pct(m.small.total / m.s.expense)} de tu gasto.</p>
								<p class="insight-strong">≈ {fmt(m.small.total * 12)} al año</p>
							</section>
						{/if}
						{#if m.top}
							<section class="insight-card" aria-labelledby="up-t">
								<h3 id="up-t"><i class="ph-duotone ph-trend-up" aria-hidden="true"></i> Lo que más subió</h3>
								<p><strong>{m.top.name}</strong> subió un {pct(m.top.delta)} frente al mes pasado.</p>
								<p class="insight-strong">{fmt(m.top.amount)}</p>
							</section>
						{/if}
					</div>
				{/if}

				<!-- En qué se fue (o de dónde vino) el dinero -->
				<section class="section-card" aria-labelledby="cat-t">
					<div class="section-header">
						<div>
							<h3 id="cat-t"><i class="ph-duotone ph-list-magnifying-glass" aria-hidden="true"></i> {kind === 'expense' ? 'En qué se fue' : 'De dónde vino'}</h3>
							<p>Toca una categoría para ver sus movimientos más grandes</p>
						</div>
					</div>
					<div class="cat-tabs-row" role="tablist">
						{#each [['expense', 'Gastos', m.s.expense], ['income', 'Ingresos', m.s.income]] as [k, label, v] (k)}
							<button type="button" role="tab" aria-selected={kind === k} class="cat-tab-btn" class:active={kind === k} onclick={() => ((kind = k), (openCat = null))}>{label} · {short(v)}</button>
						{/each}
					</div>
					{#if !m.cats.length}
						<p class="profile-help">No hay {kind === 'expense' ? 'gastos' : 'ingresos'} en {MONTHS[d.month - 1].toLowerCase()}.</p>
					{:else}
						<ul class="meter-list" role="list">
							{#each m.cats as c (c.key)}
								<li>
									<button type="button" class="meter-row" aria-expanded={openCat === c.key} onclick={() => (openCat = openCat === c.key ? null : c.key)}>
										<span class="meter-icon" style:background-color={c.color + '22'} style:color={c.color}><i class={resolveIconClass(c.icon)} aria-hidden="true"></i></span>
										<span class="meter-name">{c.name}</span>
										<span class="meter-value">{fmt(c.amount)} {@render delta(c.delta, kind === 'income')}</span>
										<span class="meter-track" aria-hidden="true"><span style:width="{(c.amount / m.cats[0].amount) * 100}%"></span></span>
										<span class="meter-share">{pct(c.share)}</span>
									</button>
									{#if openCat === c.key}
										<ul class="meter-detail" role="list">
											{#each catTx(c.key) as t (t.id)}
												<li><span>{t.title}</span><small>{formatShortDate(t.transaction_date)}</small><strong>{fmt(d.toBase(t))}</strong></li>
											{/each}
											{#if c.count > 5}<li class="profile-help">y {c.count - 5} más</li>{/if}
										</ul>
									{/if}
								</li>
							{/each}
						</ul>
					{/if}
				</section>
			{:else if y}
				<div class="credit-facts year-kpis">
					<div><span>Entró</span><strong class="text-success">{short(y.s.income)}</strong>{@render delta(change(y.s.income, y.prev.income), true)}</div>
					<div><span>Salió</span><strong>{short(y.s.expense)}</strong>{@render delta(change(y.s.expense, y.prev.expense), false)}</div>
					<div><span>Ahorraste</span><strong class={y.s.net < 0 ? 'text-danger' : 'text-success'}>{short(y.s.net)}</strong>{#if y.s.rate != null}<small>{pct(y.s.rate)} del ingreso</small>{/if}</div>
				</div>

				<section class="section-card" aria-labelledby="yr-t">
					<div class="section-header">
						<div>
							<h3 id="yr-t"><i class="ph-duotone ph-chart-bar" aria-hidden="true"></i> Ahorro de cada mes</h3>
							<p>Arriba: te sobró. Abajo: salió más de lo que entró.</p>
						</div>
					</div>
					{#if y.lived}
						<NetBars months={y.months} labels={MONTHS} {fmt} {compact} />
						<div class="year-notes">
							{#if y.best != null}<p><i class="ph-duotone ph-trophy text-success" aria-hidden="true"></i> <span>Tu mejor mes fue <strong>{MONTHS[y.best].toLowerCase()}</strong>: ahorraste {fmt(y.months[y.best].net)}.</span></p>{/if}
							{#if y.worst != null}<p><i class="ph-duotone ph-warning-circle" aria-hidden="true"></i> <span>El más ajustado fue <strong>{MONTHS[y.worst].toLowerCase()}</strong> ({fmt(y.months[y.worst].net)}).</span></p>{/if}
							<p><i class="ph-duotone ph-calendar-check" aria-hidden="true"></i> <span>En promedio gastas <strong>{fmt(y.avgExpense)}</strong> al mes.</span></p>
						</div>
						<details class="viz-table">
							<summary>Ver tabla mes a mes</summary>
							<table>
								<thead><tr><th scope="col">Mes</th><th scope="col">Entró</th><th scope="col">Salió</th><th scope="col">Ahorro</th></tr></thead>
								<tbody>
									{#each y.months as mm, i (i)}
										{#if mm.count}<tr><th scope="row">{MONTHS[i]}</th><td>{fmt(mm.income)}</td><td>{fmt(mm.expense)}</td><td class={mm.net < 0 ? 'text-danger' : 'text-success'}>{fmt(mm.net)}</td></tr>{/if}
									{/each}
								</tbody>
							</table>
						</details>
					{:else}
						<p class="profile-help">No hay movimientos en {year}.</p>
					{/if}
				</section>

				{#if y.cats.length}
					<section class="section-card" aria-labelledby="yc-t">
						<div class="section-header"><div><h3 id="yc-t"><i class="ph-duotone ph-ranking" aria-hidden="true"></i> Dónde más gastaste</h3><p>Las 6 categorías más grandes del año</p></div></div>
						<ul class="meter-list" role="list">
							{#each y.cats as c (c.key)}
								<li class="meter-row">
									<span class="meter-icon" style:background-color={c.color + '22'} style:color={c.color}><i class={resolveIconClass(c.icon)} aria-hidden="true"></i></span>
									<span class="meter-name">{c.name}</span>
									<span class="meter-value">{fmt(c.amount)}</span>
									<span class="meter-track" aria-hidden="true"><span style:width="{(c.amount / y.cats[0].amount) * 100}%"></span></span>
									<span class="meter-share">{pct(c.share)}</span>
								</li>
							{/each}
						</ul>
					</section>
				{/if}
			{/if}
		</div>
	{/if}
</div>
