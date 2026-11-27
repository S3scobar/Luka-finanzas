<script>
	// Tarjetas de crédito (antes views/creditCardsView.js)
	import { onMount } from 'svelte';
	import { slide } from 'svelte/transition';
	import { creditCardService } from '#lib/services/creditCardService.js';
	import { walletService } from '#lib/services/walletService.js';
	import { categoryService } from '#lib/services/categoryService.js';
	import { transactionService } from '#lib/services/transactionService.js';
	import { formatMoney } from '#lib/services/currencyService.js';
	import { parseCurrencyInput, formatMoneyInput } from '#lib/currencyFormatter.js';
	import { resolveIconClass } from '#lib/icons.js';
	import { formatShortDate, notifyError } from '#lib/utils.js';
	import { skeletonHtml } from '#lib/components/skeleton.js';
	import Sheet from '#lib/ui/Sheet.svelte';
	import ColorPicker from '#lib/ui/ColorPicker.svelte';

	let base = $state(null); // tarjetas, cuentas, categorías y movimientos del mes
	let selectedId = $state(null);
	let purchases = $state(null);
	let error = $state('');

	async function load() {
		try {
			const debt = await categoryService.debtCategory('card'); // antes de listar, para que ya aparezca
			const [cards, wallets, categories, monthTx] = await Promise.all([
				creditCardService.getCreditCards(),
				walletService.getWallets(),
				categoryService.getCategories('expense'),
				transactionService.getTransactions()
			]);
			base = { cards: cards || [], wallets: wallets || [], categories: categories || [], monthTx: monthTx || [], debtId: debt.id };
			if (!base.cards.some((c) => c.id === selectedId)) selectedId = base.cards[0]?.id ?? null;
			await loadPurchases();
		} catch (err) {
			error = err?.message || 'Error desconocido';
		}
	}
	// Cambiar de tarjeta solo pide sus compras, no todo de nuevo
	let req = 0;
	async function loadPurchases() {
		const mine = ++req;
		const list = selectedId ? await creditCardService.getPurchases(selectedId) : [];
		if (mine === req) purchases = list || [];
	}
	onMount(load);

	const card = $derived(base?.cards.find((c) => c.id === selectedId));
	const st = $derived(card && purchases ? creditCardService.calculateStatement(card, purchases) : null);
	const debit = $derived(base && card ? base.wallets.filter((w) => w.id !== card.wallet_id) : []);
	// Si ya hubo un pago a esta tarjeta este mes, el extracto queda en $0
	const paidThisMonth = $derived(
		card ? base.monthTx.filter((t) => t.type === 'expense' && t.title.toLowerCase().includes(`pago tarjeta: ${card.name.toLowerCase()}`)).reduce((s, t) => s + Number(t.amount), 0) : 0
	);
	const isPaid = $derived(!!st && paidThisMonth > 0 && st.totalDebt > 0);
	const due = $derived(isPaid ? 0 : (st?.estimatedStatement ?? 0));
	const used = $derived(st && st.creditLimit ? Math.min(100, Math.round(((st.creditLimit - st.availableCredit) / st.creditLimit) * 100)) : 0);

	function pick(id) {
		selectedId = id;
		purchases = null;
		loadPurchases();
	}

	async function removePurchase(p) {
		if (!confirm(`¿Eliminar "${p.title}"? El cupo se restaura y se borra también del historial de gastos.`)) return;
		try {
			await creditCardService.deletePurchase(p.id);
			await load();
		} catch (err) {
			notifyError(err);
		}
	}

	// ---------- Hojas ----------
	let cardSheet, paySheet, advSheet;
	let f = $state({});
	let formError = $state('');
	let busy = $state(false);
	const open = (sheet, data) => ((f = data), (formError = ''), sheet.open());

	const openCard = (c = null) =>
		open(cardSheet, c
			? { ...c, limitText: Number(c.credit_limit).toLocaleString('es-CO'), feeText: Number(c.management_fee || 0).toLocaleString('es-CO') }
			: { name: '', limitText: '', interest_rate_ea: 25, cutoff_day: '', payment_due_day: '', feeText: '0', color: '#8B5CF6' });
	const openPay = () => open(paySheet, { amountText: (due || st.totalDebt).toLocaleString('es-CO'), from: debit[0]?.id, category: base.debtId });
	const openAdv = () => open(advSheet, { title: '', amountText: '', installments: 12, category_id: base.categories[0]?.id, target: debit[0]?.id, feeText: '6.800' });

	// Simulación del avance: primera cuota = capital + interés del mes (tasa E.A. a mensual)
	const advSim = $derived.by(() => {
		const amount = parseCurrencyInput(f.amountText);
		if (!card || !amount || !f.installments) return null;
		const interest = amount * (Math.pow(1 + Number(card.interest_rate_ea) / 100, 1 / 12) - 1);
		return { capital: amount / f.installments, interest };
	});

	async function submit(e, sheet, action) {
		e.preventDefault();
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

	const saveCard = (e) =>
		submit(e, cardSheet, () => {
			const data = {
				name: f.name.trim(),
				credit_limit: parseCurrencyInput(f.limitText),
				interest_rate_ea: f.interest_rate_ea,
				cutoff_day: f.cutoff_day,
				payment_due_day: f.payment_due_day,
				management_fee: parseCurrencyInput(f.feeText),
				color: f.color
			};
			return f.id ? creditCardService.updateCreditCard(f.id, data) : creditCardService.createCreditCard(data);
		});
	const pay = (e) => submit(e, paySheet, () => creditCardService.payCard({ card_id: card.id, payment_amount: parseCurrencyInput(f.amountText), from_wallet_id: f.from, category_id: f.category }));
	const advance = (e) =>
		submit(e, advSheet, () =>
			creditCardService.addPurchase({
				card_id: card.id,
				category_id: f.category_id,
				title: f.title.trim(),
				total_amount: parseCurrencyInput(f.amountText),
				installments: f.installments,
				is_advance: true,
				advance_fee: parseCurrencyInput(f.feeText),
				target_wallet_id: f.target
			})
		);

	async function deleteCard() {
		if (!confirm(`¿Eliminar la tarjeta "${f.name}" con todas sus compras?`)) return;
		try {
			await creditCardService.deleteCreditCard(f.id);
			cardSheet.close();
			selectedId = null;
			await load();
		} catch (err) {
			notifyError(err);
		}
	}
</script>

{#if error && !base}
	<div class="alert-error" role="alert">Error al cargar tarjetas: {error}</div>
{:else if !base}
	{@html skeletonHtml()}
{:else if !base.cards.length}
	<div class="section-card credit-empty">
		<i class="ph-duotone ph-credit-card" aria-hidden="true"></i>
		<h2>Gestiona tus tarjetas de crédito</h2>
		<p>Controla tu cupo, calcula intereses con tu tasa E.A., simula cuotas y registra avances.</p>
		<button type="button" class="btn btn-primary" onclick={() => openCard()}><i class="ph-bold ph-plus" aria-hidden="true"></i> Agregar mi primera tarjeta</button>
	</div>
{:else}
	<div class="credit-cards-module">
		<div class="cards-tabs-row" role="tablist" aria-label="Tarjetas">
			{#each base.cards as c (c.id)}
				<button type="button" role="tab" aria-selected={c.id === selectedId} class="card-tab-btn" class:active={c.id === selectedId} onclick={() => pick(c.id)}>
					<i class="ph-bold ph-credit-card" aria-hidden="true"></i> {c.name}
				</button>
			{/each}
			<button type="button" class="btn btn-secondary btn-sm" onclick={() => openCard()}><i class="ph-bold ph-plus" aria-hidden="true"></i> Nueva</button>
		</div>

		<div class="credit-card-visual" style:background="linear-gradient(135deg, {card.color}, #1E1B4B)">
			<div class="card-visual-header">
				<div class="card-visual-brand">
					<span class="card-chip"><i class="ph-bold ph-cpu" aria-hidden="true"></i></span>
					<span class="card-brand-name">{card.name}</span>
				</div>
				<button type="button" class="btn-card-edit" aria-label="Editar {card.name}" title="Datos, tasa, fechas y cupo" onclick={() => openCard(card)}><i class="ph-bold ph-pencil-simple" aria-hidden="true"></i></button>
			</div>
			{#if st}
				<div class="card-visual-usage" role="progressbar" aria-valuenow={used} aria-valuemin="0" aria-valuemax="100" aria-label="{used}% del cupo usado">
					<span style:width="{used}%"></span>
				</div>
				<div class="card-visual-footer">
					<div><small>Cupo usado</small><strong>{formatMoney(st.creditLimit - st.availableCredit)}</strong></div>
					<div class="text-end"><small>Disponible de {formatMoney(st.creditLimit)}</small><strong class="text-avail">{formatMoney(st.availableCredit)}</strong></div>
				</div>
			{/if}
		</div>

		<div class="credit-facts">
			<div><i class="ph-duotone ph-calendar-check" aria-hidden="true"></i><span>Corte</span><strong>Día {card.cutoff_day}</strong></div>
			<div><i class="ph-duotone ph-alarm" aria-hidden="true"></i><span>Pagar antes del</span><strong class="text-danger">Día {card.payment_due_day}</strong></div>
			<div><i class="ph-duotone ph-percent" aria-hidden="true"></i><span>{card.interest_rate_ea}% E.A.</span><strong>{st?.monthlyRatePercentage ?? '…'}% mes</strong></div>
		</div>

		{#if !st}
			{@html skeletonHtml()}
		{:else}
			<section class="statement-card" aria-labelledby="st-title">
				<div class="statement-header">
					<div>
						<span class="statement-title" id="st-title"><i class="ph-duotone ph-receipt" aria-hidden="true"></i> Extracto de este mes</span>
						<p>{isPaid ? `Abonaste ${formatMoney(paidThisMonth)}. La próxima cuota llega en el corte del día ${card.cutoff_day}.` : 'Cuota vigente, intereses y cuota de manejo'}</p>
					</div>
					<strong class="statement-total {isPaid ? 'text-success' : 'text-danger'}">{formatMoney(due)}</strong>
				</div>
				<dl class="statement-breakdown">
					<div class="breakdown-item"><dt>{isPaid ? 'Capital del próximo mes' : 'Capital de este mes'}</dt><dd>{formatMoney(st.totalPrincipalToPayThisMonth)}</dd></div>
					<div class="breakdown-item"><dt>{isPaid ? 'Intereses proyectados' : 'Intereses'}</dt><dd>{formatMoney(st.totalInterestThisMonth)}</dd></div>
					{#if st.managementFee > 0}<div class="breakdown-item"><dt>Cuota de manejo</dt><dd>{formatMoney(st.managementFee)}</dd></div>{/if}
					<div class="breakdown-item total-debt-row"><dt>Deuda total</dt><dd class="text-danger">{formatMoney(st.totalDebt)}</dd></div>
				</dl>
				<div class="credit-actions">
					<button type="button" class="btn {isPaid ? 'btn-secondary' : 'btn-primary'}" onclick={openPay} disabled={!st.totalDebt}>
						<i class="ph-bold ph-check-circle" aria-hidden="true"></i> {isPaid ? 'Abonar a capital' : 'Pagar tarjeta'}
					</button>
					<button type="button" class="btn btn-secondary" onclick={openAdv}><i class="ph-bold ph-hand-coins" aria-hidden="true"></i> Avance</button>
				</div>
			</section>

			<section class="section-card" aria-labelledby="pur-title">
				<div class="section-header">
					<div>
						<h3 id="pur-title"><i class="ph-duotone ph-list-checks" aria-hidden="true"></i> Compras y avances</h3>
						<p>Cuotas pagadas y pendientes</p>
					</div>
					<span class="badge-count">{purchases.length}</span>
				</div>
				{#if !purchases.length}
					<div class="empty-state">
						<i class="ph-duotone ph-thumbs-up empty-icon text-success" aria-hidden="true"></i>
						<p>No tienes compras ni avances en esta tarjeta.</p>
						<small>Las compras se registran desde Inicio eligiendo la tarjeta como cuenta.</small>
					</div>
				{:else}
					<ul class="purchases-list" role="list">
						{#each purchases as p (p.id)}
							{@const done = p.installments_paid >= p.installments}
							{@const pct = Math.min(100, Math.round((p.installments_paid / p.installments) * 100))}
							<li class="purchase-item" class:purchase-completed={done} transition:slide={{ duration: 200 }}>
								<div class="purchase-icon" class:is-advance={p.is_advance}><i class={resolveIconClass(p.is_advance ? 'ph-hand-coins' : p.category?.icon || 'ph-shopping-bag-open')} aria-hidden="true"></i></div>
								<div class="purchase-info">
									<div class="purchase-title-wrap">
										<span class="purchase-title">{p.title}</span>
										{#if p.is_advance}<span class="badge-advance">Avance</span>{/if}
										{#if done}<span class="badge-paid"><i class="ph-bold ph-check" aria-hidden="true"></i> Pagada</span>{/if}
									</div>
									<div class="purchase-meta">{formatMoney(p.total_amount)} · {formatShortDate(p.purchase_date)}</div>
									<div class="progress-bar-container" role="progressbar" aria-valuenow={pct} aria-valuemin="0" aria-valuemax="100" aria-label="{pct}% pagado">
										<div class="progress-bar-fill" class:is-done={done} style:width="{pct}%"></div>
									</div>
									<div class="purchase-installment-text">
										<span>{done ? 'Pagada por completo' : `Cuota ${p.installments_paid} de ${p.installments} · ${formatMoney(p.total_amount / p.installments)}/mes`}</span>
										<strong>{done ? '100%' : `${p.installments - p.installments_paid} pendientes`}</strong>
									</div>
								</div>
								<button type="button" class="btn-delete-purchase" aria-label="Eliminar {p.title}" title="Eliminar y restaurar cupo" onclick={() => removePurchase(p)}><i class="ph-bold ph-trash" aria-hidden="true"></i></button>
							</li>
						{/each}
					</ul>
				{/if}
			</section>
		{/if}
	</div>
{/if}

<Sheet bind:this={cardSheet} title={f.id ? 'Editar tarjeta' : 'Nueva tarjeta'}>
	<form onsubmit={saveCard}>
		<div class="form-group">
			<label for="cc-name">Nombre</label>
			<input id="cc-name" bind:value={f.name} placeholder="Ej. Nu Mastercard, Bancolombia Visa" maxlength="40" required />
		</div>
		<div class="form-grid-2">
			<div class="form-group"><label for="cc-limit">Cupo total</label><input id="cc-limit" bind:value={f.limitText} oninput={formatMoneyInput} inputmode="numeric" placeholder="3.500.000" required /></div>
			<div class="form-group"><label for="cc-rate">Tasa % E.A.</label><input id="cc-rate" type="number" bind:value={f.interest_rate_ea} step="0.01" min="0" max="100" inputmode="decimal" required /></div>
			<div class="form-group"><label for="cc-cut">Día de corte</label><input id="cc-cut" type="number" bind:value={f.cutoff_day} min="1" max="31" inputmode="numeric" placeholder="15" required /></div>
			<div class="form-group"><label for="cc-due">Día límite de pago</label><input id="cc-due" type="number" bind:value={f.payment_due_day} min="1" max="31" inputmode="numeric" placeholder="2" required /></div>
		</div>
		<div class="form-group">
			<label for="cc-fee">Cuota de manejo mensual</label>
			<input id="cc-fee" bind:value={f.feeText} oninput={formatMoneyInput} inputmode="numeric" />
		</div>
		<div class="form-group"><label for="cc-color">Color</label><ColorPicker id="cc-color" bind:value={f.color} /></div>
		{#if formError}<div class="alert-error" role="alert">{formError}</div>{/if}
		<button class="btn btn-primary btn-block sheet-submit" disabled={busy}>{f.id ? 'Guardar cambios' : 'Crear tarjeta'}</button>
		{#if f.id}<button type="button" class="btn-link sheet-danger" onclick={deleteCard}><i class="ph-bold ph-trash" aria-hidden="true"></i> Eliminar esta tarjeta</button>{/if}
	</form>
</Sheet>

<Sheet bind:this={paySheet} title="Pagar {card?.name ?? 'tarjeta'}">
	<form onsubmit={pay}>
		<p class="profile-help">Se descuenta de tu cuenta, salda la cuota del mes y libera cupo.</p>
		{#if st}
			<div class="quick-amounts" role="group" aria-label="Montos sugeridos">
				{#if due}<button type="button" class="chip-btn" onclick={() => (f.amountText = due.toLocaleString('es-CO'))}>Cuota del mes · {formatMoney(due)}</button>{/if}
				<button type="button" class="chip-btn" onclick={() => (f.amountText = st.totalDebt.toLocaleString('es-CO'))}>Deuda total · {formatMoney(st.totalDebt)}</button>
			</div>
		{/if}
		<div class="form-group"><label for="pay-amt">Monto</label><input id="pay-amt" bind:value={f.amountText} oninput={formatMoneyInput} inputmode="numeric" required /></div>
		<div class="form-group">
			<label for="pay-from">Sale de</label>
			<select id="pay-from" bind:value={f.from} required>
				{#each debit as w (w.id)}<option value={w.id}>{w.name} ({formatMoney(w.balance, w.currency)})</option>{/each}
			</select>
		</div>
		<div class="form-group">
			<label for="pay-cat">Categoría</label>
			<select id="pay-cat" bind:value={f.category} required>
				{#each base?.categories ?? [] as c (c.id)}<option value={c.id}>{c.name}</option>{/each}
			</select>
		</div>
		{#if formError}<div class="alert-error" role="alert">{formError}</div>{/if}
		<button class="btn btn-primary btn-block sheet-submit" disabled={busy}>Confirmar pago</button>
	</form>
</Sheet>

<Sheet bind:this={advSheet} title="Avance en efectivo">
	<form onsubmit={advance}>
		<div class="form-group"><label for="adv-title">Motivo</label><input id="adv-title" bind:value={f.title} placeholder="Ej. Matrícula, imprevisto" maxlength="60" required /></div>
		<div class="form-grid-2">
			<div class="form-group"><label for="adv-amt">Monto</label><input id="adv-amt" bind:value={f.amountText} oninput={formatMoneyInput} inputmode="numeric" placeholder="300.000" required /></div>
			<div class="form-group">
				<label for="adv-n">Cuotas</label>
				<select id="adv-n" bind:value={f.installments}>{#each [6, 12, 24, 36] as n (n)}<option value={n}>{n} cuotas</option>{/each}</select>
			</div>
		</div>
		<div class="form-group">
			<label for="adv-cat">¿En qué se usará?</label>
			<select id="adv-cat" bind:value={f.category_id} required>{#each base?.categories ?? [] as c (c.id)}<option value={c.id}>{c.name}</option>{/each}</select>
		</div>
		<div class="form-group">
			<label for="adv-to">Entra a</label>
			<select id="adv-to" bind:value={f.target} required>{#each debit as w (w.id)}<option value={w.id}>{w.name} ({formatMoney(w.balance, w.currency)})</option>{/each}</select>
		</div>
		<div class="form-group"><label for="adv-fee">Comisión del banco</label><input id="adv-fee" bind:value={f.feeText} oninput={formatMoneyInput} inputmode="numeric" /></div>
		{#if advSim}
			<p class="alert-info" aria-live="polite">
				Primera cuota ≈ <strong>{formatMoney(advSim.capital + advSim.interest)}</strong>
				<small>(capital {formatMoney(advSim.capital)} + interés {formatMoney(advSim.interest)})</small>
			</p>
		{/if}
		{#if formError}<div class="alert-error" role="alert">{formError}</div>{/if}
		<button class="btn btn-primary btn-block sheet-submit" disabled={busy}>Confirmar avance</button>
	</form>
</Sheet>
