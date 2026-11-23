<script>
	// Suscripciones y pagos fijos (antes views/subscriptionsView.js)
	import { onMount } from 'svelte';
	import { flip } from 'svelte/animate';
	import { subscriptionService } from '#lib/services/subscriptionService.js';
	import { walletService } from '#lib/services/walletService.js';
	import { categoryService } from '#lib/services/categoryService.js';
	import { transactionService } from '#lib/services/transactionService.js';
	import { formatMoney } from '#lib/services/currencyService.js';
	import { parseCurrencyInput, formatMoneyInput } from '#lib/currencyFormatter.js';
	import { resolveIconClass } from '#lib/icons.js';
	import { notifyError } from '#lib/utils.js';
	import { skeletonHtml } from '#lib/components/skeleton.js';
	import Sheet from '#lib/ui/Sheet.svelte';

	const today = new Date();
	const todayIso = () => new Date().toLocaleDateString('en-CA'); // fecha local (antes UTC: de noche marcaba el día siguiente)

	let d = $state(null);
	let error = $state('');

	async function load() {
		try {
			const [subs, wallets, categories, monthTx] = await Promise.all([
				subscriptionService.getSubscriptions(),
				walletService.getWallets(),
				categoryService.getCategories('expense'),
				transactionService.getTransactions()
			]);
			d = { subs: subs || [], wallets: wallets || [], categories: categories || [], monthTx: monthTx || [] };
			error = '';
		} catch (err) {
			error = err?.message || 'Error desconocido';
		}
	}
	onMount(load);

	// Días hasta el cobro de este mes (un día 31 cae el último día en meses cortos); negativo = vencida
	const daysTo = (day) => Math.min(day, new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()) - today.getDate();
	const startsNextMonth = (s) => {
		const c = s.created_at && new Date(s.created_at);
		return !!c && c.getFullYear() === today.getFullYear() && c.getMonth() === today.getMonth() && c.getDate() > s.billing_day;
	};
	const dueLabel = (n) => (n < 0 ? `Vencida hace ${-n} ${n === -1 ? 'día' : 'días'}` : n === 0 ? 'Se cobra hoy' : n === 1 ? 'Mañana' : `En ${n} días`);

	const rows = $derived(
		d
			? d.subs.map((s) => ({
					...s,
					paid: d.monthTx.some((t) => t.type === 'expense' && t.title.toLowerCase().includes(s.name.toLowerCase())),
					days: daysTo(s.billing_day),
					// Creada este mes después de su día de cobro: no está vencida, empieza el próximo mes
					later: startsNextMonth(s)
				}))
			: []
	);
	const active = $derived(rows.filter((s) => s.is_active && !s.later)); // las que cuentan este mes
	// Por pagar: lo vencido y lo más próximo arriba
	const pending = $derived(active.filter((s) => !s.paid).sort((a, b) => a.days - b.days));
	const upcoming = $derived(rows.filter((s) => s.is_active && s.later && !s.paid));
	const paid = $derived(active.filter((s) => s.paid));
	const paused = $derived(rows.filter((s) => !s.is_active));
	const monthly = $derived(rows.filter((s) => s.is_active).reduce((t, s) => t + Number(s.amount), 0));
	const left = $derived(pending.reduce((t, s) => t + Number(s.amount), 0));
	const progress = $derived(active.length ? Math.round((paid.length / active.length) * 100) : 0);

	// ---------- Hojas ----------
	let editSheet, paySheet;
	let f = $state({});
	let formError = $state('');
	let busy = $state(false);

	function openEdit(s = null) {
		f = s
			? { ...s, amountText: Number(s.amount).toLocaleString('es-CO'), wallet_id: s.wallet_id ?? '', category_id: s.category_id ?? '' }
			: { name: '', amountText: '', billing_day: '', wallet_id: '', category_id: '' };
		formError = '';
		editSheet.open();
	}
	function openPay(s) {
		f = { sub: s, amountText: Number(s.amount).toLocaleString('es-CO'), wallet_id: s.wallet_id || d.wallets[0]?.id, date: todayIso() };
		formError = '';
		paySheet.open();
	}

	async function submit(e, sheet, action) {
		e?.preventDefault();
		busy = true;
		formError = '';
		try {
			await action();
			sheet.close();
			await load();
		} catch (err) {
			formError = err?.message || 'No se pudo guardar.';
		} finally {
			busy = false;
		}
	}

	const save = (e) =>
		submit(e, editSheet, () => {
			const amount = parseCurrencyInput(f.amountText);
			if (amount <= 0) throw new Error('Ingresa un monto mayor a 0.');
			const data = { name: f.name.trim(), amount, billing_day: Number(f.billing_day), wallet_id: f.wallet_id || null, category_id: f.category_id || null };
			return f.id ? subscriptionService.updateSubscription(f.id, data) : subscriptionService.createSubscription(data);
		});
	const pay = (e) =>
		submit(e, paySheet, () => {
			const amount = parseCurrencyInput(f.amountText);
			if (amount <= 0) throw new Error('Ingresa un monto mayor a 0.');
			return transactionService.addTransaction({
				wallet_id: f.wallet_id,
				category_id: f.sub.category_id || d.categories[0]?.id,
				type: 'expense',
				title: `Pago: ${f.sub.name}`,
				amount,
				date: f.date
			});
		});
	const togglePause = () => submit(null, editSheet, () => subscriptionService.updateSubscription(f.id, { is_active: !f.is_active }));

	async function remove() {
		if (!confirm(`¿Eliminar "${f.name}"? Los pagos ya registrados siguen en tu historial.`)) return;
		try {
			await subscriptionService.deleteSubscription(f.id);
			editSheet.close();
			await load();
		} catch (err) {
			notifyError(err);
		}
	}
</script>

<svelte:head><title>Suscripciones · LUKA</title></svelte:head>

{#snippet subCard(s)}
	<div class="sub-card" class:sub-paused={!s.is_active} class:sub-card-paid={s.paid && s.is_active}>
		<div class="sub-date-badge" aria-hidden="true"><small>día</small><span class="sub-day">{s.billing_day}</span></div>
		<div class="sub-details">
			<span class="sub-name">{s.name}</span>
			<span class="sub-amount">{formatMoney(s.amount)}<small> /mes</small></span>
			<div class="sub-meta">
				{#if !s.is_active}<span class="sub-due">Ahorras {formatMoney(s.amount)} al mes</span>
				{:else if s.later && !s.paid}<span class="sub-due">Desde el próximo mes</span>
				{:else if s.paid}<span class="sub-due is-ok"><i class="ph-bold ph-check-circle" aria-hidden="true"></i> Pagada</span>
				{:else}<span class="sub-due" class:is-late={s.days < 0} class:is-soon={s.days >= 0 && s.days <= 3}>{dueLabel(s.days)}</span>{/if}
				{#if s.category}<span><i class={resolveIconClass(s.category.icon)} aria-hidden="true"></i> {s.category.name}</span>{/if}
			</div>
			{#if s.is_active && !s.paid && !s.later}
				<button type="button" class="btn btn-primary btn-sm sub-pay" onclick={() => openPay(s)} aria-label="Pagar {s.name}"><i class="ph-bold ph-check-circle" aria-hidden="true"></i> Pagar</button>
			{/if}
		</div>
		<div class="sub-actions">
			<button type="button" class="loan-icon-btn" aria-label="Editar {s.name}" onclick={() => openEdit(s)}><i class="ph-bold ph-dots-three" aria-hidden="true"></i></button>
		</div>
	</div>
{/snippet}

<div>
	<h1 class="sr-only">Suscripciones</h1>
	{#if error && !d}
		<div class="alert-error" role="alert">Error al cargar suscripciones: {error}</div>
	{:else if !d}
		{@html skeletonHtml()}
	{:else}
		<div class="subscriptions-module">
			<section class="budget-hero-card subs-hero" aria-label="Resumen de pagos fijos">
				<span class="budget-hero-badge"><i class="ph-bold ph-repeat" aria-hidden="true"></i> Gasto fijo</span>
				<div class="budget-hero-amount-row">
					<span class="budget-hero-spent">{formatMoney(monthly)}</span>
					<span class="budget-hero-limit">al mes</span>
				</div>
				<!-- El total anual hace visible cuánto suman los pagos pequeños -->
				<p class="subs-year">≈ <strong>{formatMoney(monthly * 12)}</strong> al año</p>
				{#if active.length}
					<div class="budget-hero-progress-track" role="progressbar" aria-valuenow={progress} aria-valuemin="0" aria-valuemax="100" aria-label="{paid.length} de {active.length} pagadas">
						<div class="budget-hero-progress-fill subs-fill" style:width="{progress}%"></div>
					</div>
					<div class="budget-hero-footer">
						<span>{paid.length} de {active.length} pagadas</span>
						<span>{left ? `Falta ${formatMoney(left)}` : '¡Todo al día este mes!'}</span>
					</div>
				{/if}
			</section>

			<section class="section-card" aria-labelledby="s-title">
				<div class="section-header">
					<div>
						<h3 id="s-title"><i class="ph-duotone ph-calendar-check" aria-hidden="true"></i> Por pagar</h3>
						<p>{pending.length ? 'Ordenadas por fecha de cobro' : 'Nada pendiente este mes'}</p>
					</div>
					<button type="button" class="btn btn-primary btn-sm" onclick={() => openEdit()}><i class="ph-bold ph-plus" aria-hidden="true"></i> Nueva</button>
				</div>

				{#if !rows.some((s) => s.is_active)}
					<div class="empty-state">
						<i class="ph-duotone ph-calendar-x empty-icon" aria-hidden="true"></i>
						<p>{rows.length ? 'Todos tus pagos fijos están pausados.' : 'Aún no tienes pagos fijos.'}</p>
						<small>Agrega tu plan móvil, arriendo, Netflix o servicios.</small>
					</div>
				{:else if !pending.length && active.length}
					<div class="empty-state subs-done">
						<i class="ph-duotone ph-confetti empty-icon text-success" aria-hidden="true"></i>
						<p>¡Estás al día con todos tus pagos fijos!</p>
					</div>
				{:else}
					<ul class="subs-grid" role="list">
						{#each pending as s (s.id)}<li animate:flip={{ duration: 250 }}>{@render subCard(s)}</li>{/each}
					</ul>
				{/if}
			</section>

			{#each [['Empiezan el próximo mes', upcoming, 'ph-calendar-plus'], ['Pagadas este mes', paid, 'ph-check-circle'], ['Pausadas', paused, 'ph-pause-circle']] as [title, list, icon] (title)}
				{#if list.length}
					<details class="section-card subs-group" open={title !== 'Pausadas' && list.length <= 3}>
						<summary><i class="ph-duotone {icon}" aria-hidden="true"></i> {title} <span class="badge-count">{list.length}</span></summary>
						<ul class="subs-grid" role="list">
							{#each list as s (s.id)}<li>{@render subCard(s)}</li>{/each}
						</ul>
					</details>
				{/if}
			{/each}
		</div>
	{/if}
</div>

<Sheet bind:this={editSheet} title={f.id ? f.name : 'Nuevo pago fijo'}>
	<form onsubmit={save}>
		<div class="form-group"><label for="sb-name">Nombre</label><input id="sb-name" bind:value={f.name} placeholder="Ej. Claro, Spotify, Arriendo" maxlength="40" required /></div>
		<div class="form-grid-2">
			<div class="form-group"><label for="sb-amt">Monto mensual</label><input id="sb-amt" bind:value={f.amountText} oninput={formatMoneyInput} inputmode="numeric" placeholder="34.000" required /></div>
			<div class="form-group"><label for="sb-day">Día de cobro</label><input id="sb-day" type="number" bind:value={f.billing_day} min="1" max="31" inputmode="numeric" placeholder="8" required /></div>
		</div>
		<div class="form-group">
			<label for="sb-wallet">Cuenta habitual</label>
			<select id="sb-wallet" bind:value={f.wallet_id}>
				<option value="">Sin cuenta fija</option>
				{#each d?.wallets ?? [] as w (w.id)}<option value={w.id}>{w.name}</option>{/each}
			</select>
		</div>
		<div class="form-group">
			<label for="sb-cat">Categoría</label>
			<select id="sb-cat" bind:value={f.category_id}>
				<option value="">Sin categoría</option>
				{#each d?.categories ?? [] as c (c.id)}<option value={c.id}>{c.name}</option>{/each}
			</select>
		</div>
		{#if formError}<div class="alert-error" role="alert">{formError}</div>{/if}
		<button class="btn btn-primary btn-block sheet-submit" disabled={busy}>{f.id ? 'Guardar cambios' : 'Crear pago fijo'}</button>
		{#if f.id}
			<div class="budget-detail-actions sheet-secondary">
				<button type="button" class="btn btn-secondary text-danger" onclick={remove}><i class="ph-bold ph-trash" aria-hidden="true"></i> Eliminar</button>
				<button type="button" class="btn btn-secondary" onclick={togglePause} disabled={busy}>
					<i class="ph-bold {f.is_active ? 'ph-pause' : 'ph-play'}" aria-hidden="true"></i> {f.is_active ? 'Pausar' : 'Reanudar'}
				</button>
			</div>
		{/if}
	</form>
</Sheet>

<Sheet bind:this={paySheet} title="Pagar {f.sub?.name ?? ''}">
	<form onsubmit={pay}>
		<div class="form-group">
			<label for="sp-amt">Valor de este mes</label>
			<input id="sp-amt" bind:value={f.amountText} oninput={formatMoneyInput} inputmode="numeric" required aria-describedby="sp-help" />
			<small id="sp-help" class="profile-help">Si cambia cada mes (servicios públicos), escribe el valor de la factura.</small>
		</div>
		<div class="form-group">
			<label for="sp-wallet">Sale de</label>
			<select id="sp-wallet" bind:value={f.wallet_id} required>{#each d?.wallets ?? [] as w (w.id)}<option value={w.id}>{w.name} ({formatMoney(w.balance, w.currency)})</option>{/each}</select>
		</div>
		<div class="form-group"><label for="sp-date">Fecha</label><input id="sp-date" type="date" bind:value={f.date} max={todayIso()} required /></div>
		{#if formError}<div class="alert-error" role="alert">{formError}</div>{/if}
		<button class="btn btn-primary btn-block sheet-submit" disabled={busy}>Registrar pago</button>
	</form>
</Sheet>
