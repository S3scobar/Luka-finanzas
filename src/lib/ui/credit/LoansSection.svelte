<script>
	// Préstamos: apps de crédito, bancos y personas (antes views/loansView.js)
	import { onMount } from 'svelte';
	import { slide } from 'svelte/transition';
	import { loanService, LENDER_TYPES, isMissingLoansTable } from '#lib/services/loanService.js';
	import { walletService } from '#lib/services/walletService.js';
	import { formatMoney } from '#lib/services/currencyService.js';
	import { parseCurrencyInput, formatMoneyInput } from '#lib/currencyFormatter.js';
	import { resolveIconClass } from '#lib/icons.js';
	import { formatShortDate, notifyError } from '#lib/utils.js';
	import { skeletonHtml } from '#lib/components/skeleton.js';
	import Sheet from '#lib/ui/Sheet.svelte';

	const today = () => new Date().toLocaleDateString('en-CA'); // AAAA-MM-DD en la hora local

	let d = $state(null);
	let error = $state('');
	let missing = $state(false);

	async function load() {
		try {
			const [loans, wallets] = await Promise.all([loanService.getLoans(), walletService.getWallets()]);
			d = { rows: (loans || []).map((loan) => ({ loan, s: loanService.calculateSummary(loan) })), wallets: wallets || [] };
		} catch (err) {
			if (isMissingLoansTable(err)) missing = true;
			else error = err?.message || 'Error desconocido';
		}
	}
	onMount(load);

	// Activos primero, el más próximo a vencer arriba; los pagados al final
	const rows = $derived(
		d ? [...d.rows].sort((a, b) => a.s.isPaid - b.s.isPaid || (a.s.nextDueDate || '9').localeCompare(b.s.nextDueDate || '9')) : []
	);
	const active = $derived(rows.filter((r) => !r.s.isPaid));
	const totals = $derived({
		owed: active.reduce((t, r) => t + r.s.remaining, 0),
		paid: rows.reduce((t, r) => t + r.s.paid, 0),
		next: active.find((r) => r.s.nextDueDate)
	});

	async function act(message, fn) {
		if (!confirm(message)) return;
		try {
			await fn();
			await load();
		} catch (err) {
			notifyError(err);
		}
	}

	// ---------- Hojas ----------
	let loanSheet, paySheet;
	let f = $state({});
	let formError = $state('');
	let busy = $state(false);

	function openLoan(loan = null) {
		f = loan
			? { ...loan, principalText: Number(loan.principal).toLocaleString('es-CO'), fixed: Number(loan.installments) > 0, installments: loan.installments || 3, notes: loan.notes || '' }
			: { lender_type: 'app', name: '', principalText: '', fixed: false, installments: 3, interest_rate_ea: 0, first_due_date: '', wallet: '', notes: '' };
		formError = '';
		loanSheet.open();
	}
	function openPay(r) {
		f = { loan: r.loan, s: r.s, amountText: Math.round(r.s.nextPaymentAmount || r.s.remaining).toLocaleString('es-CO'), from: d.wallets[0]?.id, date: today() };
		formError = '';
		paySheet.open();
	}

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

	const saveLoan = (e) =>
		submit(e, loanSheet, () => {
			const principal = parseCurrencyInput(f.principalText);
			if (principal <= 0) throw new Error('El monto prestado debe ser mayor a 0.');
			if (f.fixed && !f.first_due_date) throw new Error('Indica la fecha del primer pago para calcular las cuotas.');
			const data = {
				name: f.name.trim(),
				lender_type: f.lender_type,
				principal,
				installments: f.fixed ? f.installments : null,
				interest_rate_ea: f.fixed ? f.interest_rate_ea : 0,
				first_due_date: f.first_due_date,
				notes: f.notes.trim()
			};
			return f.id ? loanService.updateLoan(f.id, data) : loanService.createLoan({ ...data, receive_wallet_id: f.wallet || null });
		});
	const pay = (e) =>
		submit(e, paySheet, () => loanService.addPayment({ loan: f.loan, amount: parseCurrencyInput(f.amountText), from_wallet_id: f.from, date: f.date }));
</script>

{#if missing}
	<div class="section-card credit-empty">
		<i class="ph-duotone ph-database" aria-hidden="true"></i>
		<h2>Falta activar los préstamos</h2>
		<p>Las tablas de préstamos aún no existen en la base de datos. Ejecuta su SQL en Supabase y vuelve a entrar.</p>
	</div>
{:else if error && !d}
	<div class="alert-error" role="alert">Error al cargar préstamos: {error}</div>
{:else if !d}
	{@html skeletonHtml()}
{:else if !rows.length}
	<div class="section-card credit-empty">
		<i class="ph-duotone ph-handshake" aria-hidden="true"></i>
		<h2>Lleva el control de tus préstamos</h2>
		<p>Anota lo que debes a apps como Addi, a un banco o a un amigo: verás cuánto falta, cuándo pagar y el avance de cada deuda.</p>
		<button type="button" class="btn btn-primary" onclick={() => openLoan()}><i class="ph-bold ph-plus" aria-hidden="true"></i> Agregar mi primer préstamo</button>
	</div>
{:else}
	<div class="loans-module">
		<div class="credit-facts loans-summary">
			<div><i class="ph-duotone ph-hand-coins" aria-hidden="true"></i><span>Debes</span><strong class="text-danger">{formatMoney(totals.owed)}</strong></div>
			<div><i class="ph-duotone ph-check-circle" aria-hidden="true"></i><span>Has pagado</span><strong class="text-success">{formatMoney(totals.paid)}</strong></div>
			<div>
				<i class="ph-duotone ph-calendar" aria-hidden="true"></i><span>Próximo pago</span>
				<strong>{totals.next ? formatShortDate(totals.next.s.nextDueDate) : '—'}</strong>
			</div>
		</div>

		<div class="section-header loans-header">
			<div>
				<h3><i class="ph-duotone ph-handshake" aria-hidden="true"></i> Mis préstamos</h3>
				<p>{active.length} {active.length === 1 ? 'activo' : 'activos'}</p>
			</div>
			<button type="button" class="btn btn-primary btn-sm" onclick={() => openLoan()}><i class="ph-bold ph-plus" aria-hidden="true"></i> Nuevo</button>
		</div>

		<ul class="loans-list" role="list">
			{#each rows as { loan, s } (loan.id)}
				{@const type = LENDER_TYPES[loan.lender_type] || LENDER_TYPES.person}
				{@const n = Number(loan.installments) || 0}
				<li class="loan-card" class:loan-paid={s.isPaid} style:--loan-color={loan.color || type.color} transition:slide={{ duration: 200 }}>
					<div class="loan-head">
						<span class="loan-icon"><i class={resolveIconClass(type.icon)} aria-hidden="true"></i></span>
						<div class="loan-title">
							<strong>{loan.name}</strong>
							<small>{[type.label, n ? `${n} cuotas de ${formatMoney(s.installmentAmount)}` : 'Pago libre', Number(loan.interest_rate_ea) > 0 && `${loan.interest_rate_ea}% E.A.`].filter(Boolean).join(' · ')}</small>
						</div>
						<button type="button" class="loan-icon-btn" aria-label="Editar {loan.name}" onclick={() => openLoan(loan)}><i class="ph-bold ph-pencil-simple" aria-hidden="true"></i></button>
						<button type="button" class="loan-icon-btn loan-icon-danger" aria-label="Eliminar {loan.name}" onclick={() => act(`¿Eliminar el préstamo "${loan.name}"? Los pagos hechos siguen en tu historial de gastos.`, () => loanService.deleteLoan(loan.id))}><i class="ph-bold ph-trash" aria-hidden="true"></i></button>
					</div>

					<div class="loan-amounts">
						<div><small>Pendiente</small><strong class={s.isPaid ? 'text-success' : 'text-danger'}>{formatMoney(s.remaining)}</strong></div>
						<div class="text-end"><small>Prestado</small><strong>{formatMoney(loan.principal)}</strong></div>
					</div>
					<div class="progress-bar-container" role="progressbar" aria-valuenow={s.progress} aria-valuemin="0" aria-valuemax="100" aria-label="{s.progress}% pagado">
						<div class="progress-bar-fill loan-fill" class:is-done={s.isPaid} style:width="{s.progress}%"></div>
					</div>
					<div class="purchase-installment-text">
						<span>{n ? `${s.installmentsPaid} de ${n} cuotas pagadas` : `Pagado ${formatMoney(s.paid)} de ${formatMoney(s.totalToPay)}`}</span>
						<strong>{s.progress}%</strong>
					</div>

					{#if s.isPaid}
						<div class="loan-due loan-due-ok"><i class="ph-bold ph-check-circle" aria-hidden="true"></i> Pagado por completo</div>
					{:else if s.nextDueDate}
						<div class="loan-due" class:loan-due-late={s.isOverdue}>
							<i class="ph-duotone ph-calendar" aria-hidden="true"></i>
							{n ? 'Próxima cuota' : 'Fecha límite'}: <strong>{formatMoney(s.nextPaymentAmount)}</strong> · {formatShortDate(s.nextDueDate)}
							{#if s.isOverdue}<span class="loan-late-tag">Vencida hace {s.daysLate} {s.daysLate === 1 ? 'día' : 'días'}</span>{/if}
						</div>
					{/if}
					{#if loan.notes}<p class="loan-notes"><i class="ph-duotone ph-note" aria-hidden="true"></i> {loan.notes}</p>{/if}

					{#if !s.isPaid}
						<button type="button" class="btn btn-primary btn-block loan-pay-btn" onclick={() => openPay({ loan, s })}><i class="ph-bold ph-money" aria-hidden="true"></i> Registrar pago</button>
					{/if}

					{#if loan.payments.length}
						<details class="loan-history">
							<summary>Historial de pagos ({loan.payments.length})</summary>
							{#each loan.payments as p (p.id)}
								<div class="loan-payment-row">
									<span>{formatShortDate(p.payment_date)}</span>
									<strong>{formatMoney(p.amount)}</strong>
									<button type="button" class="loan-icon-btn loan-icon-danger" aria-label="Eliminar pago del {formatShortDate(p.payment_date)}" onclick={() => act('¿Eliminar este pago? El dinero vuelve a tu cuenta y el gasto se borra del historial.', () => loanService.deletePayment(p))}><i class="ph-bold ph-x" aria-hidden="true"></i></button>
								</div>
							{/each}
						</details>
					{/if}
				</li>
			{/each}
		</ul>
	</div>
{/if}

<Sheet bind:this={loanSheet} title={f.id ? 'Editar préstamo' : 'Nuevo préstamo'}>
	<form onsubmit={saveLoan}>
		<div class="form-group">
			<span class="form-label" id="ln-type">¿Quién te prestó?</span>
			<div class="loan-type-pills" role="radiogroup" aria-labelledby="ln-type">
				{#each Object.entries(LENDER_TYPES) as [key, t] (key)}
					<button type="button" role="radio" aria-checked={f.lender_type === key} class="loan-type-btn" class:active={f.lender_type === key} onclick={() => (f.lender_type = key)}>
						<i class={resolveIconClass(t.icon)} aria-hidden="true"></i> {t.label}
					</button>
				{/each}
			</div>
		</div>
		<div class="form-group"><label for="ln-name">Nombre</label><input id="ln-name" bind:value={f.name} placeholder="Ej. Addi, Juan, Bancolombia" maxlength="40" required /></div>
		<div class="form-group"><label for="ln-amt">Monto prestado</label><input id="ln-amt" bind:value={f.principalText} oninput={formatMoneyInput} inputmode="numeric" placeholder="500.000" required /></div>
		<label class="zero-interest-wrap"><input type="checkbox" bind:checked={f.fixed} /> <span>Se paga en cuotas fijas</span></label>
		{#if f.fixed}
			<div class="form-grid-2" transition:slide={{ duration: 180 }}>
				<div class="form-group"><label for="ln-n">Número de cuotas</label><input id="ln-n" type="number" bind:value={f.installments} min="1" max="360" inputmode="numeric" /></div>
				<div class="form-group"><label for="ln-rate">Interés % E.A.</label><input id="ln-rate" type="number" bind:value={f.interest_rate_ea} step="0.01" min="0" inputmode="decimal" aria-describedby="ln-rate-help" /></div>
			</div>
			<small id="ln-rate-help" class="profile-help">Déjalo en 0 si no cobran intereses.</small>
		{/if}
		<div class="form-group"><label for="ln-date">{f.fixed ? 'Fecha del primer pago' : 'Fecha límite (opcional)'}</label><input id="ln-date" type="date" bind:value={f.first_due_date} /></div>
		{#if !f.id}
			<div class="form-group">
				<label for="ln-wallet">¿Recibiste el dinero en una cuenta?</label>
				<select id="ln-wallet" bind:value={f.wallet} aria-describedby="ln-wallet-help">
					<option value="">No sumar a ninguna cuenta</option>
					{#each d?.wallets ?? [] as w (w.id)}<option value={w.id}>{w.name}</option>{/each}
				</select>
				<small id="ln-wallet-help" class="profile-help">Se suma al saldo sin contarlo como ingreso.</small>
			</div>
		{/if}
		<div class="form-group"><label for="ln-notes">Nota (opcional)</label><input id="ln-notes" bind:value={f.notes} placeholder="Ej. Para la matrícula" maxlength="140" /></div>
		{#if formError}<div class="alert-error" role="alert">{formError}</div>{/if}
		<button class="btn btn-primary btn-block sheet-submit" disabled={busy}>{f.id ? 'Guardar cambios' : 'Crear préstamo'}</button>
	</form>
</Sheet>

<Sheet bind:this={paySheet} title="Pagar {f.loan?.name ?? ''}">
	<form onsubmit={pay}>
		{#if f.s}
			<div class="quick-amounts" role="group" aria-label="Montos sugeridos">
				{#if f.s.nextPaymentAmount}<button type="button" class="chip-btn" onclick={() => (f.amountText = Math.round(f.s.nextPaymentAmount).toLocaleString('es-CO'))}>Cuota · {formatMoney(f.s.nextPaymentAmount)}</button>{/if}
				<button type="button" class="chip-btn" onclick={() => (f.amountText = Math.round(f.s.remaining).toLocaleString('es-CO'))}>Todo · {formatMoney(f.s.remaining)}</button>
			</div>
		{/if}
		<div class="form-group"><label for="lp-amt">Monto</label><input id="lp-amt" bind:value={f.amountText} oninput={formatMoneyInput} inputmode="numeric" required /></div>
		<div class="form-group">
			<label for="lp-from">Sale de</label>
			<select id="lp-from" bind:value={f.from} required>{#each d?.wallets ?? [] as w (w.id)}<option value={w.id}>{w.name} ({formatMoney(w.balance, w.currency)})</option>{/each}</select>
		</div>
		<div class="form-group"><label for="lp-date">Fecha</label><input id="lp-date" type="date" bind:value={f.date} max={today()} required /></div>
		{#if formError}<div class="alert-error" role="alert">{formError}</div>{/if}
		<button class="btn btn-primary btn-block sheet-submit" disabled={busy}>Confirmar pago</button>
	</form>
</Sheet>
