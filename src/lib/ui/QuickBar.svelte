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

<div class="quick-expense-card qb" class:is-income={!isExpense}>
	<!-- Tipo: una sola pastilla de vidrio que se desliza -->
	<div class="qb-seg" role="group" aria-label="Tipo de movimiento">
		<span class="qb-thumb" aria-hidden="true"></span>
		<button type="button" class:on={isExpense} aria-pressed={isExpense} onclick={() => (type = 'expense')}>
			<i class="ph-bold ph-arrow-up-right" aria-hidden="true"></i> Gasto
		</button>
		<button type="button" class:on={!isExpense} aria-pressed={!isExpense} onclick={() => (type = 'income')}>
			<i class="ph-bold ph-arrow-down-left" aria-hidden="true"></i> Ingreso
		</button>
	</div>

	<!-- El monto es lo principal: grande, sin caja -->
	<label class="qb-amount">
		<span class="sr-only">Valor</span>
		<span class="qb-sign" aria-hidden="true">{isExpense ? '−' : '+'} {CURRENCIES[wallet?.currency]?.symbol || '$'}</span>
		<input bind:this={amountInput} value={amountText} oninput={onAmount} type="text" inputmode="numeric" placeholder="0" autocomplete="off" enterkeyhint="next" />
	</label>
	<input
		class="qb-title"
		bind:this={titleInput}
		bind:value={title}
		type="text"
		aria-label={isExpense ? 'Concepto del gasto' : 'Concepto del ingreso'}
		placeholder={isExpense ? '¿En qué? Ej. Almuerzo' : '¿De qué? Ej. Sueldo'}
		autocomplete="off"
		enterkeyhint="done"
	/>

	<div class="qb-wallets" role="radiogroup" aria-label={isExpense ? 'Cuenta con la que pagas' : 'Cuenta a la que entra'}>
		<span class="qb-k" aria-hidden="true">{isExpense ? 'Pagas con' : 'Entra a'}</span>
		{#each wallets as w (w.id)}
			{@const on = w.id === wallet?.id}
			<button type="button" role="radio" aria-checked={on} class="qb-chip" class:on style:--c={w.color || 'var(--primary)'} onclick={() => (walletId = w.id)}>
				<i class={resolveIconClass(w.icon)} aria-hidden="true"></i>{w.name}
			</button>
		{/each}
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

	{#if error}<div class="alert-error" role="alert">{error}</div>{/if}

	<p class="qb-k qb-hint">Toca una categoría para guardar</p>
	<div class="qb-cats">
		{#each isExpense ? favorites : typeCats.slice(0, 4) as cat (cat.id)}
			<button type="button" class="qb-cat" title={cat.name} onclick={() => save(cat.id)}>
				<span class="qb-tile" style:--c={cat.color}><i class={icon(cat)} aria-hidden="true"></i></span>
				<span class="qb-name">{cat.name}</span>
			</button>
		{/each}
		{#if isExpense || typeCats.length > 4}
			<button type="button" class="qb-cat" title="Otras categorías" aria-haspopup="dialog" onclick={() => picker.open()}>
				<span class="qb-tile qb-more"><i class="ph-bold ph-dots-three" aria-hidden="true"></i></span>
				<span class="qb-name">Más</span>
			</button>
		{/if}
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

<style>
	.qb { --tint: 244, 63, 94; --tone: var(--danger); display: grid; gap: 0.9rem; }
	.qb.is-income { --tint: 16, 185, 129; --tone: var(--success); }

	/* Segmentado de vidrio */
	.qb-seg { position: relative; display: grid; grid-template-columns: 1fr 1fr; padding: 4px; border-radius: 999px; background: color-mix(in srgb, var(--text-muted) 12%, transparent); }
	.qb-thumb {
		position: absolute; inset: 4px auto 4px 4px; width: calc(50% - 4px); border-radius: inherit;
		background: var(--g-chip-hover, #fff); box-shadow: 0 4px 12px -6px rgb(15 23 42 / 0.35), inset 0 1px 0 rgb(255 255 255 / 0.9);
		transition: translate 0.4s var(--g-spring, ease);
	}
	.is-income .qb-thumb { translate: 100% 0; }
	.qb-seg button {
		position: relative; display: inline-flex; align-items: center; justify-content: center; gap: 0.35rem; min-height: 40px;
		border: 0; background: none; font: inherit; font-size: var(--fs-md); font-weight: 600; color: var(--text-muted); cursor: pointer; border-radius: 999px;
		transition: color 0.25s ease;
	}
	.qb-seg button.on { color: var(--tone); }
	.qb-seg button:focus-visible { outline: 2px solid var(--primary); outline-offset: 1px; }

	/* Monto protagonista */
	.qb-amount { display: flex; align-items: baseline; justify-content: center; gap: 0.35rem; margin-top: 0.25rem; cursor: text; }
	.qb-sign { font-size: 1.5rem; font-weight: 700; color: var(--tone); opacity: 0.8; }
	.qb-amount input {
		min-width: 1ch; border: 0; padding: 0; background: none; outline: none; text-align: left;
		font: inherit; font-size: 2.4rem; font-weight: 800; letter-spacing: -0.03em; color: var(--text-main); font-variant-numeric: tabular-nums;
		field-sizing: content; max-width: 100%;
	}
	@supports not (field-sizing: content) { .qb-amount input { width: 7ch; } }
	.qb-amount input::placeholder { color: color-mix(in srgb, var(--text-muted) 55%, transparent); }
	.qb-title {
		width: 100%; min-height: 46px; padding: 0 1rem; border-radius: 14px; text-align: center;
		border: 1px solid color-mix(in srgb, var(--text-muted) 18%, transparent); background: color-mix(in srgb, var(--bg-card) 60%, transparent);
		font: inherit; font-size: var(--fs-base); color: var(--text-main); outline: none; transition: border-color 0.2s ease, box-shadow 0.2s ease;
	}
	.qb-title:focus { border-color: color-mix(in srgb, var(--tone) 55%, transparent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--tone) 15%, transparent); }

	/* Cuentas: fila desplazable sin barra visible */
	.qb-wallets { display: flex; align-items: center; gap: 0.4rem; overflow-x: auto; scrollbar-width: none; margin-inline: -0.25rem; padding: 0.15rem 0.25rem; }
	.qb-wallets::-webkit-scrollbar { display: none; }
	.qb-k { flex: none; font-size: var(--fs-xs); font-weight: 600; color: var(--text-muted); margin: 0; }
	.qb-chip {
		flex: none; display: inline-flex; align-items: center; gap: 0.35rem; min-height: 36px; padding: 0 0.8rem;
		border-radius: 999px; border: 1px solid color-mix(in srgb, var(--text-muted) 18%, transparent); background: var(--g-chip, transparent);
		font: inherit; font-size: var(--fs-sm); font-weight: 600; color: var(--text-secondary); cursor: pointer;
		transition: background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease, transform 0.2s var(--g-spring, ease);
	}
	.qb-chip:active { transform: scale(0.95); }
	.qb-chip.on { color: var(--c); border-color: color-mix(in srgb, var(--c) 55%, transparent); background: color-mix(in srgb, var(--c) 12%, transparent); }

	/* Categorías: 5 columnas que caben siempre, nombre en dos líneas */
	.qb-hint { text-align: center; margin-top: 0.1rem; }
	.qb-cats { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 0.35rem; }
	.qb-cat {
		display: grid; justify-items: center; align-content: start; gap: 0.35rem; padding: 0.35rem 0.1rem; border: 0; border-radius: 16px;
		background: none; font: inherit; cursor: pointer; transition: background-color 0.2s ease;
	}
	.qb-cat:hover { background: var(--bg-hover); }
	.qb-cat:focus-visible { outline: 2px solid var(--primary); outline-offset: 1px; }
	.qb-tile {
		display: grid; place-items: center; width: 52px; height: 52px; border-radius: 17px; font-size: 1.45rem;
		color: var(--c); background: color-mix(in srgb, var(--c) 14%, transparent);
		box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.6); transition: transform 0.25s var(--g-spring, ease);
	}
	.qb-cat:active .qb-tile { transform: scale(0.9); }
	.qb-more { --c: var(--text-secondary); background: var(--g-chip, var(--bg-hover)); border: 1px dashed color-mix(in srgb, var(--text-muted) 35%, transparent); }
	.qb-name {
		max-width: 100%; font-size: var(--fs-xs); font-weight: 600; line-height: 1.2; color: var(--text-main); text-align: center;
		display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; line-clamp: 2; overflow: hidden; overflow-wrap: anywhere; hyphens: auto;
	}
	@media (prefers-reduced-motion: reduce) { .qb-thumb, .qb-tile, .qb-chip { transition: none; } }
</style>
