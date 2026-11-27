<script>
	// Inicio: métricas del mes, avisos de pago, registro rápido y movimientos (antes views/dashboardView.js)
	import { slide } from 'svelte/transition';
	import { goto } from '$app/navigation';
	import { walletService } from '#lib/services/walletService.js';
	import { categoryService } from '#lib/services/categoryService.js';
	import { transactionService } from '#lib/services/transactionService.js';
	import { creditCardService } from '#lib/services/creditCardService.js';
	import { loanService } from '#lib/services/loanService.js';
	import { getRates, getBaseCurrency, convert, formatMoney } from '#lib/services/currencyService.js';
	import { resolveIconClass } from '#lib/icons.js';
	import { formatShortDate, notifyError } from '#lib/utils.js';
	import { skeletonHtml } from '#lib/components/skeleton.js';
	import { MediaQuery } from 'svelte/reactivity';
	import QuickBar from '#lib/ui/QuickBar.svelte';

	// En computador el Inicio es un panel completo; se descarga solo allí y el celular no cambia
	const wide = new MediaQuery('min-width: 1100px');
	let Panel = $state(null);
	$effect(() => {
		if (wide.current && !Panel) import('#lib/ui/desktop/DesktopPanel.svelte').then((m) => (Panel = m.default));
	});

	let d = $state(null);
	let error = $state('');
	let showAll = $state(false);

	// Una sola ronda de peticiones en paralelo (antes las tasas esperaban a las demás)
	async function load() {
		try {
			const [wallets, categories, transactions, creditCards, cc, loans, { rates }, base] = await Promise.all([
				walletService.getWallets(),
				categoryService.getCategories(),
				transactionService.getTransactions(),
				creditCardService.getCreditCards(),
				creditCardService.getTotalStatementSummary(),
				loanService.getTotalLoanSummary(),
				getRates(),
				getBaseCurrency()
			]);
			d = { wallets: wallets || [], categories: categories || [], transactions: transactions || [], creditCards: creditCards || [], cc, loans, rates, base };
			error = '';
		} catch (err) {
			error = err?.message || 'Error desconocido';
		}
	}
	// La vista de celular carga sus datos solo cuando se muestra
	$effect(() => {
		if (!wide.current && !d) load();
	});

	const totals = $derived.by(() => {
		if (!d) return null;
		// Cada cuenta tiene su moneda; los totales van en la moneda base. Las billeteras de tarjeta guardan cupo, no dinero.
		const currency = new Map(d.wallets.map((w) => [w.id, w.currency]));
		const cardWallets = new Set(d.creditCards.map((c) => c.wallet_id));
		const toBase = (amount, walletId) => convert(amount, currency.get(walletId), d.base, d.rates);
		const sum = (t) => d.transactions.filter((x) => x.type === t).reduce((s, x) => s + toBase(x.amount, x.wallet_id), 0);
		const income = sum('income');
		const expense = sum('expense');
		return {
			balance: d.wallets.filter((w) => !cardWallets.has(w.id)).reduce((s, w) => s + toBase(parseFloat(w.balance) || 0, w.id), 0),
			income,
			expense,
			net: income - expense
		};
	});

	const banners = $derived(
		!d
			? []
			: [
					d.cc?.hasCards && {
						section: 'cards',
						due: d.cc.totalDue,
						icon: 'fa-credit-card',
						title: d.cc.totalDue > 0 ? 'Por pagar en tarjeta este mes' : 'Tarjetas de crédito',
						sub: d.cc.totalDue > 0 ? (d.cc.earliestDueDay ? `Pagar antes del día ${d.cc.earliestDueDay}` : 'Cuota mensual pendiente') : '¡Estás al día este mes!'
					},
					d.loans?.hasLoans && {
						section: 'loans',
						due: d.loans.totalDue,
						icon: 'fa-handshake',
						title: d.loans.totalDue > 0 ? 'Por pagar en préstamos este mes' : 'Préstamos y deudas',
						sub: d.loans.totalDue > 0 ? d.loans.dueLabel : '¡Estás al día con tus préstamos!'
					}
				].filter(Boolean)
	);

	const visible = $derived(showAll ? d.transactions : d.transactions.slice(0, 5));

	// "$ 3.178.100" → símbolo aparte para dibujarlo más pequeño que la cifra
	const splitMoney = (txt) => {
		const m = String(txt).match(/^(-?\s*[^\d\s-]+\s?)(.*)$/);
		return m ? { sym: m[1].trim(), num: m[2] } : { sym: '', num: txt };
	};
	const total = $derived(totals ? splitMoney(formatMoney(totals.balance, d.base)) : null);
	const monthName = new Date().toLocaleDateString('es-CO', { month: 'long' });

	const pay = (section) => goto(section === 'loans' ? '/credito#prestamos' : '/credito');

	// Un solo movimiento abierto a la vez: tocar fuera de una fila cierra las demás
	function closeOthers(e) {
		for (const row of e.currentTarget.querySelectorAll('.swipe-reveal'))
			if (row.scrollLeft && !row.contains(e.target)) row.scrollTo({ left: 0, behavior: 'smooth' });
	}

	// La primera vez, el primer movimiento se asoma y vuelve, para que se note que se puede deslizar
	const peeked = (() => {
		try { return localStorage.getItem('luka_swipe_peek') === '1'; } catch { return true; }
	})();
	function peek(node, on) {
		if (!on || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
		try { localStorage.setItem('luka_swipe_peek', '1'); } catch {}
		const timers = [];
		timers.push(setTimeout(() => {
			node.style.scrollSnapType = 'none'; // sin snap, para poder quedar a medio camino
			node.scrollTo({ left: 64, behavior: 'smooth' });
			timers.push(setTimeout(() => {
				node.scrollTo({ left: 0, behavior: 'smooth' });
				timers.push(setTimeout(() => (node.style.scrollSnapType = ''), 500));
			}, 900));
		}, 900));
		return { destroy: () => timers.forEach(clearTimeout) };
	}

	async function remove(t) {
		// Sin confirm(): el botón rojo que aparece al deslizar ya es la confirmación
		try {
			await transactionService.deleteTransaction(t.id);
			d.transactions = d.transactions.filter((x) => x.id !== t.id); // se va de la lista al instante
			load(); // saldos y avisos se recalculan en segundo plano, sin esqueleto
		} catch (err) {
			notifyError(err);
		}
	}
</script>

<svelte:head><title>Inicio · LUKA</title></svelte:head>

<div>
	<h1 class="sr-only">Inicio</h1>
	{#if wide.current}
		{#if Panel}<Panel />{:else}{@html skeletonHtml()}{/if}
	{:else if error && !d}
		<div class="alert-error" role="alert">Error al cargar el inicio: {error}</div>
	{:else if !d}
		{@html skeletonHtml()}
	{:else}
		<div class="dashboard-module">
			<!-- Un solo saldo protagonista; el mes va debajo como tres cifras compactas -->
			<section class="balance-hero" aria-label="Resumen del mes">
				<span class="balance-hero-label">Saldo total</span>
				<p class="balance-hero-amount"><span class="balance-hero-sym">{total.sym}</span>{total.num}</p>
				<span class="balance-hero-sub">En {d.wallets.length - d.creditCards.length} {d.wallets.length - d.creditCards.length === 1 ? 'cuenta' : 'cuentas'} · {monthName}</span>
				<dl class="balance-hero-stats">
					<div>
						<dt><i class="ph-bold ph-arrow-down-left" aria-hidden="true"></i> Ingresos</dt>
						<dd class="is-income">{formatMoney(totals.income, d.base)}</dd>
					</div>
					<div>
						<dt><i class="ph-bold ph-arrow-up-right" aria-hidden="true"></i> Gastos</dt>
						<dd class="is-expense">{formatMoney(totals.expense, d.base)}</dd>
					</div>
					<div>
						<dt><i class="ph-bold ph-scales" aria-hidden="true"></i> Balance</dt>
						<dd class={totals.net < 0 ? 'is-expense' : ''}>{formatMoney(totals.net, d.base)}</dd>
					</div>
				</dl>
			</section>

			{#if banners.length}
				<div class="dashboard-banners-stack">
					{#each banners as b (b.section)}
						<div class="card-statement-banner {b.due > 0 ? 'banner-due' : 'banner-paid'}">
							<div class="banner-statement-left">
								<div class="banner-statement-icon"><i class={resolveIconClass(b.due > 0 ? b.icon : 'fa-circle-check')} aria-hidden="true"></i></div>
								<div class="banner-statement-text">
									<div class="banner-statement-title">{b.title}</div>
									<div class="banner-statement-amount">$ {b.due.toLocaleString('es-CO', { maximumFractionDigits: 0 })}</div>
									<small class="banner-statement-sub">{b.sub}</small>
								</div>
							</div>
							{#if b.due > 0}
								<button type="button" class="btn btn-sm btn-primary" onclick={() => pay(b.section)}>
									Pagar <i class="ph-bold ph-caret-right" aria-hidden="true"></i>
								</button>
							{/if}
						</div>
					{/each}
				</div>
			{/if}

			<QuickBar wallets={d.wallets} categories={d.categories} creditCards={d.creditCards} onsaved={load} />

			<section class="section-card history-section" aria-labelledby="hist-title">
				<div class="section-header">
					<div>
						<h3 id="hist-title">Movimientos recientes</h3>
						<p><i class="ph-bold ph-hand-swipe-left" aria-hidden="true"></i> Desliza a la izquierda para eliminar</p>
					</div>
					<span class="badge-count">{d.transactions.length} en total</span>
				</div>

				{#if !d.transactions.length}
					<div class="empty-state">
						<i class="ph-duotone ph-folder-open empty-icon" aria-hidden="true"></i>
						<p>No tienes movimientos registrados en este mes.</p>
						<small>Escribe un gasto arriba y presiona un icono para comenzar.</small>
					</div>
				{:else}
					<ul class="transactions-list" role="list" onpointerdown={closeOthers}>
						{#each visible as t, i (t.id)}
							{@const expense = t.type === 'expense'}
							{@const color = t.category?.color || '#94A3B8'}
							{@const kind = expense ? 'gasto' : 'ingreso'}
							<!-- Deslizar a la izquierda muestra «Eliminar»; el botón existe siempre, así que Tab o un lector de pantalla también lo alcanzan -->
							<li class="swipe-reveal" transition:slide={{ duration: 220 }} use:peek={i === 0 && !peeked} onfocusout={(e) => !e.currentTarget.contains(e.relatedTarget) && e.currentTarget.scrollTo({ left: 0 })}>
								<div class="transaction-item swipe-content">
									<div class="trans-cat-icon" style:background-color={color + '20'} style:color>
										<i class={resolveIconClass(t.category?.icon || (expense ? 'fa-tag' : 'fa-money-bill-wave'))} aria-hidden="true"></i>
									</div>
									<div class="trans-info">
										<span class="trans-title">{t.title}</span>
										<div class="trans-meta">
											<span class="trans-wallet">{t.wallet?.name || 'Cuenta'}</span>
											<span class="trans-date">{formatShortDate(t.transaction_date)}</span>
										</div>
									</div>
									<div class="trans-amount {expense ? 'amount-expense' : 'amount-income'}">
										{expense ? '−' : '+'}{formatMoney(t.amount, t.wallet?.currency)}
									</div>
								</div>
								<div class="swipe-panel">
									<button type="button" class="swipe-delete" aria-label="Eliminar {kind}: {t.title}" onclick={() => remove(t)}>
										<i class="ph-bold ph-trash" aria-hidden="true"></i>
										<span>Eliminar {kind}</span>
									</button>
								</div>
							</li>
						{/each}
					</ul>
					{#if d.transactions.length > 5}
						<button type="button" class="btn btn-secondary btn-block btn-sm btn-toggle-all" aria-expanded={showAll} onclick={() => (showAll = !showAll)}>
							<i class="ph-bold {showAll ? 'ph-caret-up' : 'ph-caret-down'}" aria-hidden="true"></i>
							{showAll ? 'Mostrar menos (solo los últimos 5)' : `Ver todos los movimientos (${d.transactions.length})`}
						</button>
					{/if}
				{/if}
			</section>
		</div>
	{/if}
</div>
