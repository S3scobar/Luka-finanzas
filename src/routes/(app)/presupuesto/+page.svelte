<script>
	// Presupuestos por categoría (antes views/budgetsView.js)
	import { flip } from 'svelte/animate';
	import { budgetService } from '#lib/services/budgetService.js';
	import { categoryService } from '#lib/services/categoryService.js';
	import { formatMoney } from '#lib/services/currencyService.js';
	import { resolveIconClass } from '#lib/icons.js';
	import { formatShortDate, notifyError } from '#lib/utils.js';
	import { skeletonHtml } from '#lib/components/skeleton.js';
	import { parseCurrencyInput, formatMoneyInput } from '#lib/currencyFormatter.js';
	import Sheet from '#lib/ui/Sheet.svelte';
	import PeriodNav from '#lib/ui/PeriodNav.svelte';

	const now = new Date();
	const RING = 2 * Math.PI * 42; // circunferencia del anillo (r = 42)

	let year = $state(now.getFullYear());
	let month = $state(now.getMonth() + 1);
	let d = $state(null);
	let error = $state('');
	let loading = $state(false);

	// Se recarga solo al cambiar de mes; la respuesta de un mes anterior no pisa la del actual
	let req = 0;
	async function load() {
		const mine = ++req;
		loading = true;
		try {
			const [budget, categories] = await Promise.all([budgetService.getBudgets(year, month), categoryService.getCategories('expense')]);
			if (mine === req) [d, error] = [{ ...budget, categories: categories || [] }, ''];
		} catch (err) {
			if (mine === req) error = err?.message || 'Error desconocido';
		} finally {
			if (mine === req) loading = false;
		}
	}
	$effect(() => {
		[year, month];
		load();
	});

	const level = (p) => (p > 100 ? 'danger' : p >= 80 ? 'warn' : 'ok');
	// Lo más urgente primero: excedidos y cerca del límite arriba
	const budgets = $derived(d ? [...d.budgets].sort((a, b) => b.percentage - a.percentage) : []);
	const free = $derived(d ? d.categories.filter((c) => !d.budgets.some((b) => b.category_id === c.id)) : []);
	// Cuánto se puede gastar por día lo que resta del mes (solo en el mes en curso)
	const perDay = $derived.by(() => {
		if (!d || year !== now.getFullYear() || month !== now.getMonth() + 1) return null;
		const daysLeft = new Date(year, month, 0).getDate() - now.getDate() + 1;
		return { days: daysLeft, amount: d.totalRemaining / daysLeft };
	});

	// ---------- Hojas ----------
	let newSheet, detailSheet;
	let form = $state({ category_id: '', limitText: '' });
	let current = $state(null); // presupuesto abierto en detalle
	let formError = $state('');
	let busy = $state(false);

	function openNew() {
		form = { category_id: free[0]?.id ?? '', limitText: '' };
		formError = '';
		newSheet.open();
	}
	function openDetail(b) {
		current = b;
		form = { category_id: b.category_id, limitText: b.limit.toLocaleString('es-CO') };
		formError = '';
		detailSheet.open();
	}

	async function save(e, sheet) {
		e.preventDefault();
		const monthly_limit = parseCurrencyInput(form.limitText);
		if (monthly_limit <= 0) return (formError = 'Ingresa un límite mayor a 0.');
		busy = true;
		try {
			await budgetService.setBudget({ category_id: form.category_id, monthly_limit });
			sheet.close();
			await load();
		} catch (err) {
			formError = err?.message || 'No se pudo guardar.';
		} finally {
			busy = false;
		}
	}

	async function remove() {
		if (!confirm(`¿Eliminar el presupuesto de ${current.category?.name}? Los gastos no se borran.`)) return;
		try {
			await budgetService.deleteBudget(current.id);
			detailSheet.close();
			await load();
		} catch (err) {
			notifyError(err);
		}
	}
</script>

<svelte:head><title>Presupuesto · LUKA</title></svelte:head>

<div>
	<h1 class="sr-only">Presupuesto</h1>
	<div class="budgets-module" class:is-loading={loading && d} aria-busy={loading}>
		<PeriodNav bind:year bind:month hint="Control de gastos por categoría" />

		{#if error && !d}
			<div class="alert-error" role="alert">Error al cargar presupuestos: {error}</div>
		{:else if !d}
			{@html skeletonHtml()}
		{:else}
			{@const g = level(d.globalPercentage)}
			<section class="budget-hero-card budget-hero-ring is-{g}" aria-label="Resumen del mes">
				<svg class="ring" viewBox="0 0 100 100" role="img" aria-label="{d.globalPercentage}% del presupuesto consumido">
					<circle class="ring-track" cx="50" cy="50" r="42" />
					<circle class="ring-fill" cx="50" cy="50" r="42" stroke-dasharray={RING} stroke-dashoffset={RING * (1 - Math.min(100, d.globalPercentage) / 100)} />
					<text x="50" y="50" class="ring-pct">{d.globalPercentage}%</text>
					<text x="50" y="66" class="ring-label">usado</text>
				</svg>
				<div class="hero-figures">
					<span class="budget-hero-badge"><i class="ph-bold ph-target" aria-hidden="true"></i> Este mes</span>
					<div class="budget-hero-amount-row">
						<span class="budget-hero-spent">{formatMoney(d.totalSpent)}</span>
						<span class="budget-hero-limit">de {formatMoney(d.totalBudgeted)}</span>
					</div>
					<span class="budget-hero-avail">
						{#if d.totalSpent > d.totalBudgeted}
							<i class="ph-bold ph-warning-circle text-danger" aria-hidden="true"></i> Te pasaste por <strong class="text-danger">{formatMoney(d.totalSpent - d.totalBudgeted)}</strong>
						{:else}
							<i class="ph-bold ph-check-circle text-success" aria-hidden="true"></i> Disponible <strong>{formatMoney(d.totalRemaining)}</strong>
						{/if}
					</span>
					{#if perDay && d.totalRemaining > 0}
						<span class="hero-perday">≈ {formatMoney(perDay.amount)} por día · {perDay.days} {perDay.days === 1 ? 'día' : 'días'} restantes</span>
					{/if}
				</div>
			</section>

			<section class="section-card" aria-labelledby="b-title">
				<div class="section-header">
					<div>
						<h3 id="b-title"><i class="ph-duotone ph-stack" aria-hidden="true"></i> Por categoría</h3>
						<p>{budgets.length ? 'Toca una para ver sus gastos o cambiar el límite.' : 'Pon un límite mensual a tus categorías frecuentes.'}</p>
					</div>
					<button type="button" class="btn btn-primary btn-sm" onclick={openNew} disabled={!free.length} title={free.length ? '' : 'Todas tus categorías ya tienen presupuesto'}>
						<i class="ph-bold ph-plus" aria-hidden="true"></i> Asignar
					</button>
				</div>

				{#if !budgets.length}
					<div class="empty-state">
						<i class="ph-duotone ph-target empty-icon" aria-hidden="true"></i>
						<p>No tienes presupuestos todavía.</p>
						<small>Empieza por Alimentación, Transporte u Ocio.</small>
					</div>
				{:else}
					<ul class="budgets-list-grid" role="list">
						{#each budgets as b (b.id)}
							{@const cat = b.category || { name: 'Sin categoría', icon: 'fa-tag', color: '#64748B' }}
							{@const lv = level(b.percentage)}
							<li animate:flip={{ duration: 250 }}>
								<button type="button" class="budget-card is-{lv}" onclick={() => openDetail(b)}>
									<div class="budget-card-header">
										<div class="budget-cat-info">
											<div class="budget-cat-icon" style:background-color={cat.color + '20'} style:color={cat.color}><i class={resolveIconClass(cat.icon)} aria-hidden="true"></i></div>
											<div class="budget-meta">
												<span class="budget-title">{cat.name}</span>
												<span class="budget-subtitle" class:text-danger={b.isExceeded}>
													{b.isExceeded ? `Excedido por ${formatMoney(-b.remaining)}` : `Te quedan ${formatMoney(b.remaining)}`}
												</span>
											</div>
										</div>
										<span class="budget-pct is-{lv}">{b.percentage}%</span>
									</div>
									<div class="budget-progress-track" role="progressbar" aria-valuenow={b.percentage} aria-valuemin="0" aria-valuemax="100" aria-label="{b.percentage}% usado">
										<div class="budget-progress-fill" style:width="{Math.min(100, b.percentage)}%" style:background-color={lv === 'ok' ? cat.color : null}></div>
									</div>
									<div class="budget-numbers-row"><strong>{formatMoney(b.spent)}</strong> de {formatMoney(b.limit)}</div>
								</button>
							</li>
						{/each}
					</ul>
				{/if}
			</section>
		{/if}
	</div>
</div>

<Sheet bind:this={newSheet} title="Nuevo presupuesto">
	<form onsubmit={(e) => save(e, newSheet)}>
		<div class="form-group">
			<label for="bg-cat">Categoría</label>
			<select id="bg-cat" bind:value={form.category_id} required>
				{#each free as c (c.id)}<option value={c.id}>{c.name}</option>{/each}
			</select>
		</div>
		<div class="form-group">
			<label for="bg-limit">Límite mensual</label>
			<input id="bg-limit" bind:value={form.limitText} oninput={formatMoneyInput} inputmode="numeric" placeholder="Ej. 500.000" autocomplete="off" required aria-describedby="bg-help" />
			<small id="bg-help" class="profile-help">Lo máximo que planeas gastar en esta categoría cada mes.</small>
		</div>
		{#if formError}<div class="alert-error" role="alert">{formError}</div>{/if}
		<button class="btn btn-primary btn-block sheet-submit" disabled={busy}>Guardar presupuesto</button>
	</form>
</Sheet>

<Sheet bind:this={detailSheet} title={current?.category?.name ?? 'Presupuesto'}>
	{#if current}
		{@const cat = current.category || { icon: 'fa-tag', color: '#64748B' }}
		<div class="budget-detail-stats">
			<div><span>Límite</span><strong>{formatMoney(current.limit)}</strong></div>
			<div><span>Gastado</span><strong class="text-danger">{formatMoney(current.spent)}</strong></div>
			<div><span>{current.isExceeded ? 'Excedido' : 'Disponible'}</span><strong class={current.isExceeded ? 'text-danger' : 'text-success'}>{formatMoney(Math.abs(current.remaining))}</strong></div>
		</div>

		<h2 class="budget-detail-title">Gastos del mes <small>{current.transactions.length}</small></h2>
		{#if current.transactions.length}
			<ul class="transactions-list budget-detail-list" role="list">
				{#each current.transactions as t (t.id)}
					<li class="transaction-item">
						<div class="trans-cat-icon" style:background-color={cat.color + '20'} style:color={cat.color}><i class={resolveIconClass(cat.icon)} aria-hidden="true"></i></div>
						<div class="trans-info">
							<span class="trans-title">{t.title}</span>
							<div class="trans-meta">
								<span class="trans-wallet"><i class="ph-duotone ph-wallet" aria-hidden="true"></i> {t.wallet?.name || 'Cuenta'}</span>
								<span class="trans-date">{formatShortDate(t.transaction_date)}</span>
							</div>
						</div>
						<div class="trans-amount amount-expense">- {formatMoney(t.amount, t.wallet?.currency)}</div>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="profile-help">Aún no hay gastos en esta categoría este mes.</p>
		{/if}

		<!-- Cambiar el límite aquí mismo, sin abrir otra ventana -->
		<form class="budget-detail-edit" onsubmit={(e) => save(e, detailSheet)}>
			<div class="form-group">
				<label for="bg-edit">Límite mensual</label>
				<input id="bg-edit" bind:value={form.limitText} oninput={formatMoneyInput} inputmode="numeric" autocomplete="off" required />
			</div>
			{#if formError}<div class="alert-error" role="alert">{formError}</div>{/if}
			<div class="budget-detail-actions">
				<button type="button" class="btn btn-secondary text-danger" onclick={remove}><i class="ph-bold ph-trash" aria-hidden="true"></i> Eliminar</button>
				<button class="btn btn-primary" disabled={busy}>Guardar límite</button>
			</div>
		</form>
	{/if}
</Sheet>
