<script>
	// Inicio: métricas del mes, avisos de pago, registro rápido y movimientos (antes views/dashboardView.js)
	import { onMount } from 'svelte';
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
	import QuickBar from '#lib/ui/QuickBar.svelte';

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
	onMount(load);

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

	async function pay(section) {
		(await import('#lib/views/creditView.js')).creditView.section = section;
		goto('/credito');
	}

	async function remove(t) {
		if (!confirm('¿Deseas eliminar este movimiento? Su valor volverá a tu cuenta.')) return;
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
	{#if error && !d}
		<div class="alert-error" role="alert">Error al cargar el inicio: {error}</div>
	{:else if !d}
		{@html skeletonHtml()}
	{:else}
		<div class="dashboard-module">
			<div class="summary-cards-grid">
				<div class="metric-card card-total">
					<span class="metric-label"><i class="ph-bold ph-wallet" aria-hidden="true"></i> Saldo Total</span>
					<span class="metric-value text-primary">{formatMoney(totals.balance, d.base)}</span>
				</div>
				<div class="metric-card card-income">
					<span class="metric-label"><i class="ph-bold ph-arrow-down-left text-success" aria-hidden="true"></i> Ingresos</span>
					<span class="metric-value text-success">{formatMoney(totals.income, d.base)}</span>
				</div>
				<div class="metric-card card-expense">
					<span class="metric-label"><i class="ph-bold ph-arrow-up-right text-danger" aria-hidden="true"></i> Gastos</span>
					<span class="metric-value text-danger">{formatMoney(totals.expense, d.base)}</span>
				</div>
				<div class="metric-card card-balance">
					<span class="metric-label"><i class="ph-duotone ph-scales" aria-hidden="true"></i> Balance</span>
					<span class="metric-value {totals.net < 0 ? 'text-danger' : 'text-balance'}">{formatMoney(totals.net, d.base)}</span>
				</div>
			</div>

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
						<h3 id="hist-title"><i class="ph-duotone ph-clock-counter-clockwise" aria-hidden="true"></i> Movimientos Recientes</h3>
						<p>Tus últimos registros de este mes</p>
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
					<ul class="transactions-list" role="list">
						{#each visible as t (t.id)}
							{@const expense = t.type === 'expense'}
							{@const color = t.category?.color || '#94A3B8'}
							<li class="transaction-item" transition:slide={{ duration: 220 }}>
								<div class="trans-cat-icon" style:background-color={color + '20'} style:color>
									<i class={resolveIconClass(t.category?.icon || (expense ? 'fa-tag' : 'fa-money-bill-wave'))} aria-hidden="true"></i>
								</div>
								<div class="trans-info">
									<span class="trans-title">{t.title}</span>
									<div class="trans-meta">
										<span class="trans-wallet"><i class="ph-duotone ph-wallet" aria-hidden="true"></i> {t.wallet?.name || 'Cuenta'}</span>
										<span class="trans-date">{formatShortDate(t.transaction_date)}</span>
									</div>
								</div>
								<div class="trans-amount {expense ? 'amount-expense' : 'amount-income'}">
									{expense ? '-' : '+'} {formatMoney(t.amount, t.wallet?.currency)}
								</div>
								<button type="button" class="btn-delete-trans" aria-label="Eliminar {t.title}" title="Eliminar movimiento" onclick={() => remove(t)}>
									<i class="ph-bold ph-trash" aria-hidden="true"></i>
								</button>
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
