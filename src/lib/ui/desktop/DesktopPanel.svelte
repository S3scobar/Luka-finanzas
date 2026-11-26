<script>
	// Inicio en computador: panel financiero completo. Solo se descarga y se pinta en pantallas anchas
	// (ver routes/(app)/+page.svelte); el celular sigue con su vista de siempre.
	import { onMount } from 'svelte';
	import { slide } from 'svelte/transition';
	import { walletService } from '#lib/services/walletService.js';
	import { categoryService } from '#lib/services/categoryService.js';
	import { transactionService } from '#lib/services/transactionService.js';
	import { creditCardService } from '#lib/services/creditCardService.js';
	import { loanService } from '#lib/services/loanService.js';
	import { budgetService } from '#lib/services/budgetService.js';
	import { subscriptionService } from '#lib/services/subscriptionService.js';
	import { goalService } from '#lib/services/goalService.js';
	import { getRates, getBaseCurrency, convert, formatMoney } from '#lib/services/currencyService.js';
	import { byCategory, smallExpenses, projectMonth } from '#lib/analytics.js';
	import { last12, healthScore, upcoming } from '#lib/panel.js';
	import { resolveIconClass } from '#lib/icons.js';
	import { formatShortDate, notifyError } from '#lib/utils.js';
	import { session } from '#lib/session.svelte.js';
	import { skeletonHtml } from '#lib/components/skeleton.js';
	import QuickBar from '#lib/ui/QuickBar.svelte';

	const SMALL = { COP: 20000, USD: 5, EUR: 5 }; // tope de un "gasto hormiga", igual que en Análisis
	const DONUT = ['#2563EB', '#F59E0B', '#14B8A6', '#8B5CF6', '#E11D48', '#94A3B8'];
	const now = new Date();
	const day = now.getDate();
	const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

	let d = $state(null);
	let error = $state('');

	// Lo opcional (presupuestos, suscripciones, metas) no tumba el panel si falla
	const soft = (p) => p.catch(() => null);
	async function load() {
		try {
			const y = now.getFullYear();
			const [wallets, categories, creditCards, cc, loans, { rates }, base, month, yearNow, yearPrev, budgets, subs, goals] = await Promise.all([
				walletService.getWallets(),
				categoryService.getCategories(),
				creditCardService.getCreditCards(),
				creditCardService.getTotalStatementSummary(),
				loanService.getTotalLoanSummary(),
				getRates(),
				getBaseCurrency(),
				transactionService.getTransactions(),
				transactionService.getYearlyTransactions(y),
				now.getMonth() < 11 ? transactionService.getYearlyTransactions(y - 1) : [],
				soft(budgetService.getBudgets()),
				soft(subscriptionService.getSubscriptions()),
				soft(goalService.getGoals())
			]);
			d = { wallets: wallets || [], categories: categories || [], creditCards: creditCards || [], cc, loans, rates, base, month: month || [], year: [...(yearPrev || []), ...(yearNow || [])], budgets, subs: subs || [], goals: goals || [] };
			error = '';
		} catch (err) {
			error = err?.message || 'Error desconocido';
		}
	}
	onMount(load);

	const fmt = (v) => formatMoney(v, d?.base);
	const short = (v) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: d?.base || 'COP', notation: 'compact', maximumFractionDigits: 1 }).format(v);
	const pct = (v) => `${Math.round(v * 100)}%`;
	const signed = (v, unit = '%') => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toLocaleString('es-CO', { maximumFractionDigits: 1 })}${unit}`;
	const change = (a, b) => (b > 0 ? ((a - b) / b) * 100 : null);

	const p = $derived.by(() => {
		if (!d) return null;
		const toBase = (t) => convert(Number(t.amount), t.wallet?.currency, d.base, d.rates);
		const series = last12(d.year, toBase, now);
		const cur = series[11], prev = series[10];
		const cardWallets = new Set(d.creditCards.map((c) => c.wallet_id));
		const balance = d.wallets
			.filter((w) => !cardWallets.has(w.id))
			.reduce((s, w) => s + convert(parseFloat(w.balance) || 0, w.currency, d.base, d.rates), 0);

		// Salud: cada pieza solo cuenta si hay datos para calcularla
		const past = series.slice(0, 11).filter((m) => m.count);
		const avgExpense = past.length ? past.reduce((s, m) => s + m.expense, 0) / past.length : cur.expense;
		const saved = d.goals.reduce((s, g) => s + (Number(g.current_amount) || 0), 0);
		const debtDue = (d.cc?.totalDue || 0) + (d.loans?.totalDue || 0);
		const subsTotal = d.subs.reduce((s, x) => s + (Number(x.amount) || 0), 0);
		const b = d.budgets;
		const metrics = {
			rate: cur.rate,
			fund: d.goals.length && avgExpense > 0 ? saved / avgExpense : null,
			debt: cur.income > 0 && (d.cc?.hasCards || d.loans?.hasLoans) ? debtDue / cur.income : null,
			pace: b?.totalBudgeted > 0 ? b.totalSpent / b.totalBudgeted / (day / daysInMonth) : null
		};

		// Categorías del mes: las 5 mayores y el resto junto
		const cats = byCategory(d.month, 'expense', toBase);
		const top = cats.slice(0, 5);
		const rest = cats.slice(5).reduce((s, c) => s + c.amount, 0);
		if (rest > 0) top.push({ key: 'rest', name: 'Otras', amount: rest, share: rest / cur.expense });

		// Insights: solo los que tienen datos detrás
		const insights = [];
		if (cur.income > 0 && day < daysInMonth) {
			const proj = projectMonth(cur.expense, day, daysInMonth);
			const left = cur.income - proj;
			insights.push(left >= 0
				? { icon: 'ph-trend-up', tone: 'good', title: `Cerrarías el mes ahorrando ≈ ${short(left)}`, text: `Si sigues gastando a este ritmo, terminarías con gastos de ${short(proj)}.` }
				: { icon: 'ph-warning', tone: 'bad', title: `A este ritmo gastarías ${short(-left)} más de lo que entra`, text: `Proyección de gastos al cierre: ${short(proj)}.` });
		}
		const prevKey = prev.key;
		const prevCats = new Map(byCategory(d.year.filter((t) => String(t.transaction_date).startsWith(prevKey)), 'expense', toBase).map((c) => [c.key, c.amount]));
		const jump = cats
			.map((c) => ({ ...c, before: prevCats.get(c.key) || 0 }))
			.filter((c) => c.before > 0 && c.amount > c.before * 1.15)
			.sort((a, z) => z.amount - z.before - (a.amount - a.before))[0];
		if (jump) insights.push({ icon: 'ph-chart-line-up', tone: 'warn', title: `${jump.name} va ${Math.round(change(jump.amount, jump.before))}% arriba`, text: `Llevas ${fmt(jump.amount)} este mes; el mes pasado fueron ${fmt(jump.before)} en total.` });
		const ants = smallExpenses(d.month, SMALL[d.base] ?? SMALL.COP, toBase);
		if (ants.count >= 3) insights.push({ icon: 'ph-coins', tone: 'info', title: `${ants.count} gastos hormiga suman ${short(ants.total)}`, text: 'Compras pequeñas que juntas pesan. Revisa cuáles puedes evitar.' });
		if (subsTotal > 0 && cur.income > 0) insights.push({ icon: 'ph-calendar-check', tone: 'info', title: `Tus suscripciones son el ${pct(subsTotal / cur.income)} de tus ingresos`, text: `${d.subs.length} activas por ${fmt(subsTotal)} al mes.` });

		return {
			series,
			cur,
			balance,
			kpis: [
				{ label: 'Saldo total', icon: 'ph-wallet', tone: 'blue', value: fmt(balance), sub: `en ${d.wallets.length - cardWallets.size} cuentas` },
				{ label: 'Ingresos del mes', icon: 'ph-arrow-down-left', tone: 'green', value: fmt(cur.income), delta: change(cur.income, prev.income), good: (v) => v >= 0, spark: series.map((m) => m.income) },
				{ label: 'Gastos del mes', icon: 'ph-arrow-up-right', tone: 'rose', value: fmt(cur.expense), delta: change(cur.expense, prev.expense), good: (v) => v <= 0, spark: series.map((m) => m.expense) },
				{ label: 'Tasa de ahorro', icon: 'ph-piggy-bank', tone: 'violet', value: cur.rate == null ? '—' : pct(cur.rate), delta: cur.rate != null && prev.rate != null ? (cur.rate - prev.rate) * 100 : null, unit: ' pts', good: (v) => v >= 0, spark: series.map((m) => m.rate ?? 0) }
			],
			health: healthScore(metrics),
			metrics,
			healthRows: [
				metrics.fund != null && { label: 'Fondo de emergencia', value: `${metrics.fund.toLocaleString('es-CO', { maximumFractionDigits: 1 })} meses`, fill: metrics.fund / 6, tone: metrics.fund >= 3 ? 'green' : 'amber' },
				metrics.debt != null && { label: 'Deuda del mes / ingresos', value: pct(metrics.debt), fill: metrics.debt, tone: metrics.debt <= 0.3 ? 'blue' : 'rose' },
				subsTotal > 0 && cur.income > 0 && { label: 'Suscripciones / ingresos', value: pct(subsTotal / cur.income), fill: subsTotal / cur.income, tone: 'violet' },
				metrics.pace != null && { label: 'Presupuesto usado', value: `${pct(b.totalSpent / b.totalBudgeted)} · día ${day} de ${daysInMonth}`, fill: b.totalSpent / b.totalBudgeted, tone: metrics.pace <= 1 ? 'green' : 'amber' }
			].filter(Boolean),
			cats: top,
			pays: upcoming({ subs: d.subs, cc: d.cc, loans: d.loans }, now),
			insights: insights.slice(0, 3),
			budgets: (b?.budgets || []).slice().sort((a, z) => z.percentage - a.percentage).slice(0, 6)
		};
	});

	// ---------- Gráfica de flujo de caja (un solo eje: ingresos, gastos y su diferencia)
	const CH = 264, PAD = { l: 52, r: 8, t: 12, b: 28 };
	let cw = $state(600);
	let hover = $state(null);
	// Eje con pasos redondos (1, 2 o 5 × 10ⁿ) que cubren del menor ahorro neto al mayor ingreso o gasto
	const step = $derived.by(() => {
		if (!p) return 1;
		const hi = Math.max(1, ...p.series.map((m) => Math.max(m.income, m.expense)));
		const raw = (hi - Math.min(0, ...p.series.map((m) => m.net))) / 4;
		const mag = 10 ** Math.floor(Math.log10(raw));
		return [1, 2, 5, 10].map((k) => k * mag).find((v) => v >= raw);
	});
	const top = $derived(p ? Math.ceil(Math.max(1, ...p.series.map((m) => Math.max(m.income, m.expense))) / step) * step : 1);
	const lo = $derived(p ? Math.floor(Math.min(0, ...p.series.map((m) => m.net)) / step) * step : 0);
	const yv = (v) => PAD.t + ((top - v) / (top - lo)) * (CH - PAD.t - PAD.b);
	const band = $derived(Math.max(0, (cw - PAD.l - PAD.r) / 12));
	const bw = $derived(Math.min(14, band * 0.3));
	const cx = (i) => PAD.l + band * i + band / 2;
	const ticks = $derived(Array.from({ length: Math.round((top - lo) / step) + 1 }, (_, i) => lo + i * step));
	const netPath = $derived(p ? p.series.map((m, i) => `${i ? 'L' : 'M'}${cx(i)},${yv(m.net)}`).join('') : '');
	// Barra con el extremo superior redondeado
	function col(x, v) {
		const y0 = yv(0), y1 = yv(v), r = Math.min(4, (y0 - y1) / 2, bw / 2);
		if (y0 - y1 < 0.5) return '';
		return `M${x},${y0}V${y1 + r}Q${x},${y1} ${x + r},${y1}H${x + bw - r}Q${x + bw},${y1} ${x + bw},${y1 + r}V${y0}Z`;
	}

	// Mini tendencias de las tarjetas de arriba
	function spark(vals, w = 92, h = 34) {
		const mn = Math.min(...vals), mx = Math.max(...vals), span = mx - mn || 1;
		const pts = vals.map((v, i) => [(i * w) / (vals.length - 1), h - ((v - mn) / span) * h]);
		const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join('');
		return { line, area: `${line}L${w},${h + 4}L0,${h + 4}Z` };
	}

	// Dona: arcos con un pequeño respiro entre ellos
	const R = 70, C = 2 * Math.PI * R;
	const arcs = $derived.by(() => {
		let acc = 0;
		return (p?.cats || []).map((c, i) => {
			const len = c.share * C;
			const a = { ...c, color: c.key === 'rest' ? DONUT[5] : DONUT[i % 5], dash: `${Math.max(0, len - 3)} ${C}`, offset: -acc };
			acc += len;
			return a;
		});
	});

	const greeting = now.getHours() < 12 ? 'Buenos días' : now.getHours() < 19 ? 'Buenas tardes' : 'Buenas noches';
	const today = new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: 'numeric', month: 'long' }).format(now);
	const ringLen = 2 * Math.PI * 58;

	let showAll = $state(false);
	const rows = $derived(d ? (showAll ? d.month : d.month.slice(0, 8)) : []);
	async function remove(t) {
		if (!confirm('¿Deseas eliminar este movimiento? Su valor volverá a tu cuenta.')) return;
		try {
			await transactionService.deleteTransaction(t.id);
			d.month = d.month.filter((x) => x.id !== t.id);
			load();
		} catch (err) {
			notifyError(err);
		}
	}
</script>

{#if error && !d}
	<div class="alert-error" role="alert">Error al cargar el panel: {error}</div>
{:else if !p}
	{@html skeletonHtml()}
{:else}
	<div class="desk">
		<header class="desk-head">
			<div>
				<p class="desk-hello">{greeting}{session.name ? `, ${session.name.split(' ')[0]}` : ''}</p>
				<p class="desk-date">{today} · así va tu mes</p>
			</div>
		</header>

		<!-- Indicadores -->
		{#each p.kpis as k, i (k.label)}
			<article class="dcard kpi tone-{k.tone}" class:kpi-lead={i === 0}>
				<div class="kpi-top">
					<span class="tile"><i class="ph-bold {k.icon}" aria-hidden="true"></i></span>
					<h2 class="eyebrow">{k.label}</h2>
				</div>
				<p class="kpi-value">{k.value}</p>
				<div class="kpi-foot">
					{#if k.delta != null}
						<span class="pill {k.good(k.delta) ? 'is-good' : 'is-bad'}">{signed(k.delta, k.unit)}</span>
						<span class="muted">vs. mes pasado</span>
					{:else if k.sub}
						<span class="muted">{k.sub}</span>
					{/if}
				</div>
				{#if k.spark}
					{@const s = spark(k.spark)}
					<svg class="spark" viewBox="0 -2 92 40" preserveAspectRatio="none" aria-hidden="true">
						<path class="spark-area" d={s.area} />
						<path class="spark-line" d={s.line} />
					</svg>
				{/if}
			</article>
		{/each}

		<!-- Flujo de caja -->
		<section class="dcard span-8" aria-labelledby="cf-title">
			<div class="dhead">
				<div>
					<h2 id="cf-title">Flujo de caja</h2>
					<p class="muted">Ingresos y gastos de los últimos 12 meses</p>
				</div>
				<div class="legend" aria-hidden="true">
					<span><i class="key k-inc"></i>Ingresos</span>
					<span><i class="key k-exp"></i>Gastos</span>
					<span><i class="key k-net"></i>Ahorro neto</span>
				</div>
			</div>
			<div class="viz cash" bind:clientWidth={cw}>
				<svg width={cw} height={CH} role="group" aria-label="Ingresos, gastos y ahorro neto por mes">
					{#each ticks as t, i (i)}
						<line class="viz-grid" x1={PAD.l} x2={cw - PAD.r} y1={yv(t)} y2={yv(t)} />
						<text class="viz-tick" x={PAD.l - 8} y={yv(t)} text-anchor="end" dominant-baseline="middle">{short(t)}</text>
					{/each}
					<line class="viz-base" x1={PAD.l} x2={cw - PAD.r} y1={yv(0)} y2={yv(0)} />
					{#each p.series as m, i (m.key)}
						<!-- svelte-ignore a11y_no_noninteractive_tabindex (cada mes se enfoca para leer sus cifras) -->
						<g
							role="img"
							tabindex="0"
							aria-label="{m.label}: entró {fmt(m.income)}, salió {fmt(m.expense)}, neto {fmt(m.net)}"
							onpointerenter={() => (hover = i)}
							onpointerleave={() => (hover = null)}
							onfocus={() => (hover = i)}
							onblur={() => (hover = null)}
						>
							<rect class="hit" class:is-on={hover === i || (hover == null && i === 11)} x={cx(i) - band / 2 + 3} y={PAD.t - 4} width={Math.max(0, band - 6)} height={CH - PAD.t - PAD.b + 26} rx="10" />
							<path class="b-inc" d={col(cx(i) - bw - 1, m.income)} />
							<path class="b-exp" d={col(cx(i) + 1, m.expense)} />
							<text class="viz-tick" class:is-now={i === 11} x={cx(i)} y={CH - 8} text-anchor="middle">{m.label}</text>
						</g>
					{/each}
					<path class="net-line" d={netPath} />
					{#each p.series as m, i (m.key)}
						<circle class="net-dot" class:is-now={i === 11} cx={cx(i)} cy={yv(m.net)} r={i === 11 ? 4.5 : 3} />
					{/each}
				</svg>
				{#if hover != null}
					{@const m = p.series[hover]}
					<div class="viz-tip" style:left="{Math.min(Math.max(cx(hover), 90), cw - 90)}px" style:top="{yv(Math.max(m.income, m.expense, 0))}px" role="status">
						<strong>{m.label}</strong>
						<span><i class="key k-inc"></i>Ingresos {fmt(m.income)}</span>
						<span><i class="key k-exp"></i>Gastos {fmt(m.expense)}</span>
						<span><i class="key k-net"></i>Neto {fmt(m.net)}</span>
					</div>
				{/if}
			</div>
		</section>

		<!-- Salud financiera -->
		<section class="dcard span-4" aria-labelledby="hs-title">
			<div class="dhead">
				<h2 id="hs-title">Salud financiera</h2>
				{#if p.health}<span class="pill {p.health.score >= 60 ? 'is-good' : p.health.score >= 40 ? 'is-warn' : 'is-bad'}">{p.health.label}</span>{/if}
			</div>
			{#if p.health}
				<div class="health">
					<svg class="hring" width="136" height="136" viewBox="0 0 136 136" role="img" aria-label="Puntaje de salud financiera: {p.health.score} de 100">
						<defs>
							<linearGradient id="ring-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#60A5FA" /><stop offset="1" stop-color="#7C3AED" /></linearGradient>
						</defs>
						<circle class="ring-track" cx="68" cy="68" r="58" />
						<circle class="ring-val" cx="68" cy="68" r="58" stroke-dasharray="{(p.health.score / 100) * ringLen} {ringLen}" />
						<text x="68" y="66" text-anchor="middle" class="ring-num">{p.health.score}</text>
						<text x="68" y="88" text-anchor="middle" class="ring-sub">de 100</text>
					</svg>
					<p class="muted health-note">Combina tu tasa de ahorro, tu fondo de emergencia, tus deudas del mes y el ritmo de tu presupuesto.</p>
				</div>
				<ul class="meters" role="list">
					{#each p.healthRows as r (r.label)}
						<li>
							<span>{r.label}</span><strong>{r.value}</strong>
							<span class="bar"><span class="fill tone-{r.tone}" style:width="{Math.min(1, Math.max(0.02, r.fill)) * 100}%"></span></span>
						</li>
					{/each}
				</ul>
			{:else}
				<p class="muted empty">Registra ingresos y gastos este mes para calcular tu puntaje.</p>
			{/if}
		</section>

		<!-- Registro rápido -->
		<div class="span-7 quick">
			<QuickBar wallets={d.wallets} categories={d.categories} creditCards={d.creditCards} onsaved={load} />
		</div>

		<!-- Próximos pagos -->
		<section class="dcard span-5" aria-labelledby="up-title">
			<div class="dhead">
				<div>
					<h2 id="up-title">Próximos pagos</h2>
					<p class="muted">{p.pays.length ? `14 días · ${fmt(p.pays.reduce((s, x) => s + x.amount, 0))} comprometidos` : 'Nada por pagar en los próximos 14 días'}</p>
				</div>
				<a class="link" href="/suscripciones">Ver todo</a>
			</div>
			<ul class="pays" role="list">
				{#each p.pays.slice(0, 5) as x, i (i)}
					<li>
						<span class="date" style:--c={x.color || '#2563EB'}>
							<b>{x.date.getDate()}</b>
							<small>{x.date.toLocaleDateString('es-CO', { month: 'short' }).replace('.', '')}</small>
						</span>
						<span class="what"><strong>{x.name}</strong><small class:is-late={x.overdue}>{x.overdue ? 'Vencido' : x.inDays === 0 ? 'Hoy' : x.inDays === 1 ? 'Mañana' : `En ${x.inDays} días`} · {x.kind}</small></span>
						<strong class="amt">{fmt(x.amount)}</strong>
					</li>
				{/each}
			</ul>
		</section>

		<!-- Presupuesto -->
		<section class="dcard span-4" aria-labelledby="bu-title">
			<div class="dhead">
				<div>
					<h2 id="bu-title">Presupuesto del mes</h2>
					<p class="muted">{d.budgets?.totalBudgeted ? `${fmt(d.budgets.totalSpent)} de ${fmt(d.budgets.totalBudgeted)}` : 'Aún no tienes presupuestos'}</p>
				</div>
				<a class="link" href="/presupuesto">{d.budgets?.totalBudgeted ? 'Ajustar' : 'Crear'}</a>
			</div>
			<ul class="meters budgets" role="list">
				{#each p.budgets as b (b.id)}
					<li>
						<span>{b.category?.name || 'Categoría'}</span><strong class:is-over={b.percentage >= 90}>{b.percentage}%</strong>
						<span class="bar"><span class="fill" style:background={b.percentage >= 90 ? 'var(--danger)' : b.category?.color || 'var(--primary)'} style:width="{Math.min(100, Math.max(2, b.percentage))}%"></span></span>
						<small class="muted">{fmt(b.spent)} de {fmt(b.limit)}</small>
					</li>
				{/each}
			</ul>
		</section>

		<!-- Dona de categorías -->
		<section class="dcard span-4" aria-labelledby="dn-title">
			<div class="dhead">
				<div>
					<h2 id="dn-title">¿En qué se va tu dinero?</h2>
					<p class="muted">Gastos por categoría este mes</p>
				</div>
			</div>
			{#if arcs.length}
				<div class="donut">
					<svg width="168" height="168" viewBox="0 0 168 168" aria-hidden="true">
						<g transform="rotate(-90 84 84)">
							{#each arcs as a (a.key)}
								<circle cx="84" cy="84" r={R} fill="none" stroke={a.color} stroke-width="20" stroke-dasharray={a.dash} stroke-dashoffset={a.offset} />
							{/each}
						</g>
						<text x="84" y="82" text-anchor="middle" class="donut-num">{short(p.cur.expense)}</text>
						<text x="84" y="102" text-anchor="middle" class="ring-sub">gastado</text>
					</svg>
					<ul class="keys" role="list">
						{#each arcs as a (a.key)}
							<li><i style:background={a.color}></i><span>{a.name}</span><strong>{pct(a.share)}</strong></li>
						{/each}
					</ul>
				</div>
			{:else}
				<p class="muted empty">Sin gastos este mes todavía.</p>
			{/if}
		</section>

		<!-- Insights -->
		<section class="dcard span-4 wide-md" aria-labelledby="in-title">
			<div class="dhead">
				<h2 id="in-title"><i class="ph-duotone ph-sparkle" aria-hidden="true"></i> Insights de LUKA</h2>
				<a class="link" href="/analisis">Análisis</a>
			</div>
			{#if p.insights.length}
				<ul class="insights" role="list">
					{#each p.insights as x (x.title)}
						<li class="tone-{x.tone}">
							<span class="tile"><i class="ph-bold {x.icon}" aria-hidden="true"></i></span>
							<span><strong>{x.title}</strong><small>{x.text}</small></span>
						</li>
					{/each}
				</ul>
			{:else}
				<p class="muted empty">Con unos días más de movimientos te mostraremos hallazgos aquí.</p>
			{/if}
		</section>

		<!-- Movimientos -->
		<section class="dcard span-12" aria-labelledby="mv-title">
			<div class="dhead">
				<div>
					<h2 id="mv-title">Movimientos del mes</h2>
					<p class="muted">{d.month.length} en total</p>
				</div>
			</div>
			{#if d.month.length}
				<table class="tx">
					<thead>
						<tr><th scope="col">Fecha</th><th scope="col">Descripción</th><th scope="col">Categoría</th><th scope="col">Cuenta</th><th scope="col" class="num">Monto</th><th scope="col"><span class="sr-only">Acciones</span></th></tr>
					</thead>
					<tbody>
						{#each rows as t (t.id)}
							{@const expense = t.type === 'expense'}
							<tr transition:slide={{ duration: 200 }}>
								<td class="muted">{formatShortDate(t.transaction_date)}</td>
								<td><strong>{t.title}</strong></td>
								<td>
									<span class="cat" style:--c={t.category?.color || '#94A3B8'}>
										<i class={resolveIconClass(t.category?.icon || (expense ? 'fa-tag' : 'fa-money-bill-wave'))} aria-hidden="true"></i>
										{t.category?.name || (expense ? 'Sin categoría' : 'Ingreso')}
									</span>
								</td>
								<td class="muted">{t.wallet?.name || 'Cuenta'}</td>
								<td class="num {expense ? '' : 'is-in'}">{expense ? '−' : '+'}{formatMoney(t.amount, t.wallet?.currency)}</td>
								<td class="act">
									<button type="button" class="btn-delete-trans" aria-label="Eliminar {t.title}" title="Eliminar movimiento" onclick={() => remove(t)}>
										<i class="ph-bold ph-trash" aria-hidden="true"></i>
									</button>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
				{#if d.month.length > 8}
					<button type="button" class="btn btn-secondary btn-sm more" aria-expanded={showAll} onclick={() => (showAll = !showAll)}>
						{showAll ? 'Mostrar menos' : `Ver los ${d.month.length} movimientos`}
					</button>
				{/if}
			{:else}
				<p class="muted empty">No tienes movimientos este mes. Regístralos arriba.</p>
			{/if}
		</section>
	</div>
{/if}

<style>
	.desk {
		--blue: #2563eb; --green: #059669; --rose: #e11d48; --violet: #7c3aed; --amber: #d97706;
		display: grid;
		grid-template-columns: repeat(12, minmax(0, 1fr));
		gap: 1rem;
		align-items: start;
	}
	.desk > :global(*) { min-width: 0; }
	.desk-head { grid-column: 1 / -1; padding: 0.25rem 0 0.25rem; }
	.desk-hello { margin: 0; font-size: 1.75rem; font-weight: 750; letter-spacing: -0.02em; color: var(--text-main); }
	.desk-date { margin: 0.2rem 0 0; color: var(--text-muted); font-size: 0.9rem; }
	.desk-date::first-letter { text-transform: uppercase; }

	.dcard {
		position: relative;
		grid-column: span 3;
		padding: 1.15rem 1.25rem;
		border-radius: 22px;
		background: var(--lg-fill, var(--liquid-bg));
		-webkit-backdrop-filter: var(--lg-blur, blur(20px));
		backdrop-filter: var(--lg-blur, blur(20px));
		border: 1px solid var(--lg-border, var(--liquid-border));
		box-shadow: var(--lg-shadow, var(--liquid-shadow));
	}
	.span-4 { grid-column: span 4; }
	.span-5 { grid-column: span 5; }
	.span-7 { grid-column: span 7; }
	.span-8 { grid-column: span 8; }
	.span-12 { grid-column: 1 / -1; }
	.span-8, .span-4 { align-self: stretch; }
	.quick :global(.quick-expense-card) { margin: 0; height: 100%; }
	.quick { align-self: stretch; }

	h2 { margin: 0; font-size: 1.05rem; font-weight: 700; color: var(--text-main); display: flex; align-items: center; gap: 0.4rem; }
	.muted { color: var(--text-muted); font-size: 0.82rem; margin: 0.15rem 0 0; }
	.empty { padding: 1.5rem 0 0.5rem; text-align: center; }
	.dhead { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; margin-bottom: 1rem; }
	.link { font-size: 0.82rem; font-weight: 650; color: var(--primary); text-decoration: none; padding: 0.25rem 0.5rem; border-radius: 8px; }
	.link:hover { background: var(--primary-soft); }

	.tone-blue { --c: var(--blue); } .tone-green { --c: var(--green); } .tone-rose { --c: var(--rose); } .tone-violet { --c: var(--violet); } .tone-amber { --c: var(--amber); }
	.tile { display: grid; place-items: center; width: 32px; height: 32px; border-radius: 10px; flex: none; color: var(--c); background: color-mix(in srgb, var(--c) 12%, transparent); font-size: 1rem; }

	/* KPI */
	.kpi { align-self: stretch; }
	.kpi-top { display: flex; align-items: center; gap: 0.6rem; }
	.eyebrow { font-size: 0.7rem; font-weight: 650; letter-spacing: 0.06em; text-transform: uppercase; color: var(--text-muted); }
	.kpi-value { margin: 0.75rem 0 0.4rem; font-size: 1.6rem; font-weight: 750; letter-spacing: -0.02em; color: var(--text-main); font-variant-numeric: tabular-nums; }
	.kpi-foot { display: flex; align-items: center; gap: 0.45rem; }
	.kpi-foot .muted { margin: 0; font-size: 0.75rem; }
	.spark { display: block; width: 100%; height: 40px; margin-top: 0.75rem; overflow: visible; }
	.spark-line { fill: none; stroke: var(--c); stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; vector-effect: non-scaling-stroke; }
	.spark-area { fill: color-mix(in srgb, var(--c) 14%, transparent); }

	/* El saldo total abre la fila con la misma tarjeta de marca que en el celular (polish.css: .balance-hero) */
	.kpi.kpi-lead {
		color: #fff;
		border-color: rgba(255, 255, 255, 0.14);
		background:
			radial-gradient(120% 90% at 100% 0%, rgba(16, 185, 129, 0.28), transparent 55%),
			radial-gradient(90% 80% at 0% 100%, rgba(59, 130, 246, 0.55), transparent 60%),
			linear-gradient(160deg, #1D4ED8 0%, #1E3A8A 55%, #0F172A 100%);
		box-shadow: 0 18px 40px -20px rgba(30, 58, 138, 0.7), inset 0 1px 0 rgba(255, 255, 255, 0.18);
	}
	:global(:root[data-theme='dark']) .kpi.kpi-lead {
		background:
			radial-gradient(120% 90% at 100% 0%, rgba(16, 185, 129, 0.22), transparent 55%),
			radial-gradient(90% 80% at 0% 100%, rgba(37, 99, 235, 0.45), transparent 60%),
			linear-gradient(160deg, #1E3A8A 0%, #172554 55%, #0B1220 100%);
	}
	.kpi-lead .tile { color: #fff; background: rgba(255, 255, 255, 0.14); }
	.kpi-lead .eyebrow, .kpi-lead .kpi-foot .muted { color: rgba(219, 234, 254, 0.8); }
	.kpi-lead .kpi-value { color: #fff; font-size: 2rem; letter-spacing: -0.03em; }
	.pill { display: inline-flex; padding: 0.15rem 0.5rem; border-radius: 999px; font-size: 0.72rem; font-weight: 700; font-variant-numeric: tabular-nums; }
	.is-good { background: var(--success-soft); color: var(--success-text); }
	.is-bad { background: var(--danger-soft); color: var(--danger-text); }
	.is-warn { background: var(--warning-soft); color: var(--warning-text); }

	/* Flujo de caja */
	.legend { display: flex; gap: 1rem; font-size: 0.78rem; color: var(--text-secondary); }
	.legend span { display: inline-flex; align-items: center; gap: 0.35rem; }
	.key { display: inline-block; width: 10px; height: 10px; border-radius: 3px; flex: none; }
	.k-inc { background: var(--green); } .k-exp { background: var(--rose); } .k-net { background: var(--blue); height: 3px; border-radius: 2px; }
	.cash .hit { fill: transparent; transition: fill 0.2s ease; }
	.cash .hit.is-on { fill: color-mix(in srgb, var(--blue) 7%, transparent); }
	.cash g { outline: none; cursor: default; }
	.cash g:focus-visible .hit { stroke: var(--primary); stroke-width: 1.5; }
	.b-inc { fill: var(--green); }
	.b-exp { fill: var(--rose); opacity: 0.85; }
	.net-line { fill: none; stroke: var(--blue); stroke-width: 2.25; stroke-linejoin: round; stroke-linecap: round; pointer-events: none; }
	.net-dot { fill: var(--bg-card, #fff); stroke: var(--blue); stroke-width: 2; pointer-events: none; }
	.net-dot.is-now { fill: var(--blue); }
	.viz-tick.is-now { font-weight: 700; fill: var(--text-main); }
	.cash .viz-tip { top: auto; translate: -50% calc(-100% - 10px); }
	.cash .viz-tip span { gap: 0.4rem; }

	/* Salud */
	.health { display: flex; align-items: center; gap: 1rem; margin-bottom: 0.9rem; }
	.hring { flex: none; }
	.ring-track { fill: none; stroke: var(--border); stroke-width: 11; }
	.ring-val { fill: none; stroke: url(#ring-g); stroke-width: 11; stroke-linecap: round; transform: rotate(-90deg); transform-origin: 68px 68px; transition: stroke-dasharray 0.8s var(--g-smooth, ease); }
	.ring-num { font-size: 34px; font-weight: 800; fill: var(--text-main); letter-spacing: -1px; }
	.ring-sub { font-size: 12px; fill: var(--text-muted); }
	.health-note { font-size: 0.8rem; line-height: 1.45; text-wrap: pretty; }

	.meters { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.75rem; }
	.meters li { display: grid; grid-template-columns: 1fr auto; gap: 0.3rem 0.5rem; font-size: 0.82rem; color: var(--text-secondary); }
	.meters strong { color: var(--text-main); font-variant-numeric: tabular-nums; }
	.meters strong.is-over { color: var(--danger); }
	.meters small { grid-column: 1 / -1; margin: 0; font-size: 0.74rem; }
	.bar { grid-column: 1 / -1; height: 6px; border-radius: 99px; background: var(--border); overflow: hidden; }
	.fill { display: block; height: 100%; border-radius: inherit; background: var(--c, var(--primary)); transition: width 0.6s var(--g-smooth, ease); }
	.budgets { gap: 0.85rem; }

	/* Próximos pagos */
	.pays { list-style: none; margin: 0; padding: 0; }
	.pays li { display: flex; align-items: center; gap: 0.8rem; padding: 0.55rem 0; border-top: 1px solid color-mix(in srgb, var(--border) 70%, transparent); }
	.pays li:first-child { border-top: 0; padding-top: 0; }
	.date { display: grid; place-items: center; width: 42px; height: 42px; border-radius: 12px; flex: none; line-height: 1; color: var(--c); background: color-mix(in srgb, var(--c) 11%, transparent); }
	.date b { font-size: 1rem; }
	.date small { font-size: 0.6rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; }
	.what { flex: 1; min-width: 0; display: grid; }
	.what strong { font-size: 0.88rem; color: var(--text-main); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.what small { font-size: 0.75rem; color: var(--text-muted); }
	.what small.is-late { color: var(--danger); font-weight: 650; }
	.amt { font-size: 0.88rem; color: var(--text-main); font-variant-numeric: tabular-nums; }

	/* Dona */
	.donut { display: flex; align-items: center; gap: 1.1rem; }
	.donut svg { flex: none; }
	.donut circle { transition: stroke-dasharray 0.6s var(--g-smooth, ease); }
	.donut-num { font-size: 17px; font-weight: 800; fill: var(--text-main); }
	.keys { list-style: none; margin: 0; padding: 0; flex: 1; display: grid; gap: 0.5rem; min-width: 0; }
	.keys li { display: flex; align-items: center; gap: 0.5rem; font-size: 0.8rem; color: var(--text-secondary); }
	.keys i { width: 10px; height: 10px; border-radius: 3px; flex: none; }
	.keys span { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.keys strong { color: var(--text-main); font-variant-numeric: tabular-nums; }

	/* Insights */
	.insights { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.6rem; }
	.insights li { display: flex; gap: 0.7rem; padding: 0.7rem 0.75rem; border-radius: 14px; background: color-mix(in srgb, var(--c) 6%, transparent); border: 1px solid color-mix(in srgb, var(--c) 18%, transparent); }
	.insights .tone-good { --c: var(--green); } .insights .tone-bad { --c: var(--rose); } .insights .tone-warn { --c: var(--amber); } .insights .tone-info { --c: var(--blue); }
	.insights span:last-child { display: grid; gap: 0.15rem; }
	.insights strong { font-size: 0.85rem; color: var(--text-main); line-height: 1.3; }
	.insights small { font-size: 0.77rem; color: var(--text-muted); line-height: 1.4; }

	/* Movimientos */
	.tx { width: 100%; border-collapse: collapse; font-size: 0.86rem; }
	.tx th { text-align: left; font-size: 0.7rem; font-weight: 650; letter-spacing: 0.06em; text-transform: uppercase; color: var(--text-faint, var(--text-muted)); padding: 0 0.75rem 0.6rem; border-bottom: 1px solid var(--border); }
	.tx td { padding: 0.55rem 0.75rem; border-bottom: 1px solid color-mix(in srgb, var(--border) 60%, transparent); color: var(--text-main); }
	.tx tbody tr { transition: background-color 0.15s ease; }
	.tx tbody tr:hover { background: var(--bg-hover); }
	.tx .num { text-align: right; font-weight: 700; font-variant-numeric: tabular-nums; }
	.tx .is-in { color: var(--success-text); }
	.tx .act { width: 1%; }
	.tx td.muted { font-size: 0.84rem; }
	.cat { display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.15rem 0.55rem; border-radius: 999px; font-size: 0.76rem; font-weight: 600; color: var(--c); background: color-mix(in srgb, var(--c) 11%, transparent); }
	.more { margin-top: 0.9rem; }

	@media (max-width: 1280px) {
		.kpi { grid-column: span 6; }
		.desk { grid-auto-flow: row dense; }
		.span-4, .span-5 { grid-column: span 6; }
		.span-8, .span-7, .wide-md { grid-column: 1 / -1; }
	}
	@media (prefers-reduced-motion: reduce) {
		.ring-val, .fill, .donut circle, .cash .hit { transition: none; }
	}
</style>
