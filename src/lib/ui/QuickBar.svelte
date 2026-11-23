<script>
	// Registro rápido de gastos e ingresos (antes components/quickExpenseBar.js + modalCategoryPicker.js)
	import { fade } from 'svelte/transition';
	import { CURRENCIES } from '#lib/services/currencyService.js';
	import { transactionService } from '#lib/services/transactionService.js';
	import { creditCardService } from '#lib/services/creditCardService.js';
	import { resolveIconClass } from '#lib/icons.js';
	import Sheet from './Sheet.svelte';

	let { wallets, categories, creditCards = [], onsaved } = $props();

	const INSTALLMENTS = [1, 2, 3, 6, 12, 24, 36];
	const cop = (n) => Math.round(n).toLocaleString('es-CO');

	let type = $state('expense');
	let walletId = $state(null);
	let title = $state('');
	let amountText = $state('');
	let installments = $state(1);
	let zeroInt = $state(false);
	let saving = $state(null); // { amount, type } mientras se guarda
	let error = $state('');
	let titleInput, amountInput, picker;

	const isExpense = $derived(type === 'expense');
	const amount = $derived(Number(amountText.replace(/\D/g, '')) || 0);
	// Sin elección (o si la cuenta elegida ya no existe) se usa la primera
	const wallet = $derived(wallets.find((w) => w.id === walletId) ?? wallets[0]);
	// Si la cuenta elegida es una tarjeta, el gasto es una compra a cuotas
	const card = $derived(isExpense ? creditCards.find((c) => c.wallet_id === wallet?.id) : null);
	const typeCats = $derived(categories.filter((c) => c.type === type));
	const favorites = $derived(
		categories
			.filter((c) => c.type === 'expense' && c.is_favorite)
			.sort((a, b) => a.favorite_order - b.favorite_order)
			.slice(0, 4)
	);
	const firstQuota = $derived.by(() => {
		if (!card || !amount) return null;
		const monthly = Math.pow(1 + Number(card.interest_rate_ea) / 100, 1 / 12) - 1;
		return { capital: amount / installments, interest: amount * monthly };
	});

	const icon = (c) => resolveIconClass(c.icon || (isExpense ? 'fa-tag' : 'fa-money-bill-wave'));

	function onAmount(e) {
		const raw = e.currentTarget.value.replace(/\D/g, '');
		amountText = raw ? Number(raw).toLocaleString('es-CO') : '';
		e.currentTarget.value = amountText;
	}

	async function save(categoryId) {
		if (saving) return; // evita registros duplicados por doble toque
		error = '';
		if (!title.trim()) {
			error = 'Por favor escribe un nombre para el gasto.';
			return titleInput.focus();
		}
		if (amount <= 0) {
			error = 'Ingresa un valor válido mayor a 0.';
			return amountInput.focus();
		}
		saving = { amount, type };
		const minDelay = new Promise((r) => setTimeout(r, 600)); // la animación se alcanza a ver
		try {
			await (card
				? creditCardService.addPurchase({
						card_id: card.id,
						category_id: categoryId,
						title: title.trim(),
						total_amount: amount,
						installments,
						is_advance: false,
						is_zero_interest: installments > 1 && zeroInt
					})
				: transactionService.addTransaction({ wallet_id: wallet?.id, category_id: categoryId, type, title: title.trim(), amount }));
			await minDelay;
			title = amountText = '';
			zeroInt = false;
			onsaved?.();
		} catch (err) {
			error = err?.message || 'Error al registrar.';
		} finally {
			saving = null;
		}
	}
</script>

<div class="quick-expense-card">
	<div class="type-toggle-pill" class:is-expense={isExpense} class:is-income={!isExpense} role="group" aria-label="Tipo de movimiento">
		<span class="toggle-slider-blob" aria-hidden="true"></span>
		<button type="button" class="toggle-btn" class:active={isExpense} class:expense={isExpense} aria-pressed={isExpense} onclick={() => (type = 'expense')}>
			<i class="ph-bold ph-trend-down" aria-hidden="true"></i> Gasto
		</button>
		<button type="button" class="toggle-btn" class:active={!isExpense} class:income={!isExpense} aria-pressed={!isExpense} onclick={() => (type = 'income')}>
			<i class="ph-bold ph-trend-up" aria-hidden="true"></i> Ingreso
		</button>
	</div>

	<div class="wallet-chips-section">
		<span class="action-hint" id="qb-wallet-hint">
			<i class="ph-duotone ph-wallet" aria-hidden="true"></i>
			{isExpense ? '¿Con qué cuenta pagas?' : '¿A qué cuenta entra el dinero?'}
		</span>
		<div class="wallet-chips-row" role="radiogroup" aria-labelledby="qb-wallet-hint">
			{#each wallets as w (w.id)}
				{@const on = w.id === wallet?.id}
				<button
					type="button"
					role="radio"
					aria-checked={on}
					class="wallet-chip-btn"
					class:selected={on}
					style:border-color={on ? w.color : null}
					style:background-color={on ? w.color + '15' : null}
					style:color={on ? w.color : null}
					onclick={() => (walletId = w.id)}
				>
					<i class={resolveIconClass(w.icon)} aria-hidden="true"></i>
					<span class="chip-name">{w.name}</span>
				</button>
			{/each}
		</div>
	</div>

	{#if card}
		<div class="credit-cuotas-bar">
			<div class="cuotas-row">
				<label for="quick-installments"><i class="ph-duotone ph-stack text-primary" aria-hidden="true"></i> Cuotas de la compra:</label>
				<select id="quick-installments" class="cuotas-select" bind:value={installments}>
					{#each INSTALLMENTS as n (n)}<option value={n}>{n === 1 ? '1 cuota (Sin interés)' : `${n} cuotas`}</option>{/each}
				</select>
			</div>
			{#if installments > 1}
				<label class="zero-interest-wrap">
					<input type="checkbox" bind:checked={zeroInt} />
					<span><i class="ph-duotone ph-tag-chevron text-success" aria-hidden="true"></i> 0% Interés (Convenio con el comercio)</span>
				</label>
			{/if}
			<div class="credit-info-box" aria-live="polite">
				{#if installments === 1}
					<i class="ph-duotone ph-shield-check text-success" aria-hidden="true"></i> 1 cuota: Pagas al corte sin intereses corrientes.
				{:else if zeroInt}
					<i class="ph-duotone ph-tag text-success" aria-hidden="true"></i>
					{#if amount}<strong>0% Interés:</strong> Pagarás <strong>$ {cop(amount / installments)}/mes</strong> en cada cuota (Sin intereses por convenio).
					{:else}Diferido a {installments} cuotas sin interés (0% por convenio).{/if}
				{:else if firstQuota}
					<i class="ph-duotone ph-calculator text-primary" aria-hidden="true"></i>
					Pagarás aprox. <strong>$ {cop(firstQuota.capital + firstQuota.interest)}</strong> en la cuota 1 (Capital: $ {cop(firstQuota.capital)} + Int: $ {cop(firstQuota.interest)}).
				{:else}
					Diferido a {installments} cuotas ({card.interest_rate_ea}% E.A.).
				{/if}
			</div>
		</div>
	{/if}

	<div class="quick-inputs-row">
		<div class="input-field input-title">
			<input
				bind:this={titleInput}
				bind:value={title}
				type="text"
				aria-label={isExpense ? 'Concepto del gasto' : 'Concepto del ingreso'}
				placeholder={isExpense ? '¿En qué gastaste? (Ej. Almuerzo)' : '¿Concepto del ingreso? (Ej. Sueldo)'}
				autocomplete="off"
				enterkeyhint="next"
			/>
		</div>
		<div class="input-field input-amount">
			<span class="currency-symbol" aria-hidden="true">{CURRENCIES[wallet?.currency]?.symbol || '$'}</span>
			<input bind:this={amountInput} value={amountText} oninput={onAmount} type="text" inputmode="numeric" aria-label="Valor" placeholder="0" autocomplete="off" />
		</div>
	</div>

	{#if error}<div class="alert-error" role="alert">{error}</div>{/if}

	<div class="categories-action-section">
		<span class="action-hint">Toca una categoría para guardar el {isExpense ? 'gasto' : 'ingreso'}:</span>
		<div class="quick-icons-row">
			{#each isExpense ? favorites : typeCats.slice(0, 4) as cat (cat.id)}
				<button type="button" class="btn-fav-category" title={cat.name} onclick={() => save(cat.id)}>
					<div class="fav-icon-box" style:background-color={cat.color + '20'} style:color={cat.color}><i class={icon(cat)} aria-hidden="true"></i></div>
					<span class="fav-label">{cat.name}</span>
				</button>
			{/each}
			{#if isExpense || typeCats.length > 4}
				<button type="button" class="btn-fav-category btn-more" title="Otras categorías" aria-haspopup="dialog" onclick={() => picker.open()}>
					<div class="fav-icon-box"><i class="ph-bold ph-plus" aria-hidden="true"></i></div>
					<span class="fav-label">Más</span>
				</button>
			{/if}
		</div>
	</div>
</div>

<Sheet bind:this={picker} title="Selecciona una categoría">
	<div class="modal-categories-grid">
		{#each typeCats as cat (cat.id)}
			<button type="button" class="cat-modal-btn" onclick={() => (picker.close(), save(cat.id))}>
				<div class="cat-icon-circle" style:background-color={cat.color + '20'} style:color={cat.color}><i class={icon(cat)} aria-hidden="true"></i></div>
				<span class="cat-modal-label">{cat.name}</span>
			</button>
		{/each}
	</div>
</Sheet>

{#if saving}
	<div class="expense-anim-overlay" out:fade={{ duration: 250 }} role="status">
		<div class="expense-anim-card" class:is-expense={saving.type === 'expense'} class:is-income={saving.type === 'income'}>
			<div class="anim-illustration" aria-hidden="true">
				<span class="flying-particle particle-1"><i class="ph-bold {saving.type === 'expense' ? 'ph-money' : 'ph-coins'}"></i></span>
				<span class="flying-particle particle-2"><i class="ph-bold {saving.type === 'expense' ? 'ph-coins' : 'ph-money'}"></i></span>
				<span class="flying-particle particle-3"><i class="ph-bold {saving.type === 'expense' ? 'ph-trend-down' : 'ph-hand-coins'}"></i></span>
				<div class="wallet-anim-box"><i class="ph-duotone ph-wallet"></i></div>
			</div>
			<div class="anim-text-wrap">
				<span class="anim-amount" class:text-danger={saving.type === 'expense'} class:text-success={saving.type === 'income'}>
					{saving.type === 'expense' ? '-' : '+'} $ {saving.amount.toLocaleString('es-CO')}
				</span>
				<span class="anim-label">{saving.type === 'expense' ? 'Registrando gasto...' : 'Sumando a tus ingresos...'}</span>
			</div>
		</div>
	</div>
{/if}
