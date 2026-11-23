<script>
	// Billeteras y categorías (antes views/walletsView.js)
	import { onMount } from 'svelte';
	import { slide } from 'svelte/transition';
	import { walletService } from '#lib/services/walletService.js';
	import { categoryService } from '#lib/services/categoryService.js';
	import { creditCardService } from '#lib/services/creditCardService.js';
	import { getRates, getBaseCurrency, convert, formatMoney, CURRENCIES } from '#lib/services/currencyService.js';
	import { CATEGORY_ICON_GROUPS, WALLET_ICONS, resolveIconClass } from '#lib/icons.js';
	import { notifyError } from '#lib/utils.js';
	import { skeletonHtml } from '#lib/components/skeleton.js';
	import { parseCurrencyInput, formatMoneyInput } from '#lib/currencyFormatter.js';
	import Sheet from '#lib/ui/Sheet.svelte';
	import IconPicker from '#lib/ui/IconPicker.svelte';
	import ColorPicker from '#lib/ui/ColorPicker.svelte';

	const PREVIEW = 4; // categorías visibles antes de "Ver todas"

	let d = $state(null);
	let error = $state('');
	let tab = $state('expense');
	let showAllCats = $state(false);
	let favNote = $state('');

	async function load() {
		try {
			const [wallets, categories, cards, { rates }, base] = await Promise.all([
				walletService.getWallets(),
				categoryService.getCategories(),
				creditCardService.getCreditCards(),
				getRates(),
				getBaseCurrency()
			]);
			d = { wallets: wallets || [], categories: categories || [], cardWallets: new Set((cards || []).map((c) => c.wallet_id)), rates, base };
			error = '';
		} catch (err) {
			error = err?.message || 'Error desconocido';
		}
	}
	onMount(load);

	const inBase = (w) => convert(w.balance, w.currency, d.base, d.rates);
	// El cupo de una tarjeta no es dinero propio: no suma al total (igual que en Inicio)
	const own = $derived(d ? d.wallets.filter((w) => !d.cardWallets.has(w.id)) : []);
	const total = $derived(own.reduce((s, w) => s + inBase(w), 0));
	const favIds = $derived(
		d ? d.categories.filter((c) => c.type === 'expense' && c.is_favorite).sort((a, b) => a.favorite_order - b.favorite_order).map((c) => c.id) : []
	);
	// En Gastos las favoritas van primero: son las que aparecen en el registro rápido
	const cats = $derived(
		d ? d.categories.filter((c) => c.type === tab).sort((a, b) => (favIds.indexOf(a.id) + 1 || 99) - (favIds.indexOf(b.id) + 1 || 99)) : []
	);
	const countOf = (type) => d.categories.filter((c) => c.type === type).length;

	// ---------- Favoritas: se guardan al tocar (antes había que acordarse de "Guardar") ----------
	let favQueue = Promise.resolve();
	function toggleFav(cat) {
		const ids = favIds.includes(cat.id) ? favIds.filter((id) => id !== cat.id) : [...favIds, cat.id];
		if (ids.length > 4) return (favNote = 'Solo puedes tener 4 favoritas. Quita una para elegir otra.');
		favNote = '';
		for (const c of d.categories) if (c.type === 'expense') [c.is_favorite, c.favorite_order] = [ids.includes(c.id), ids.indexOf(c.id) + 1];
		// En cola: dos toques rápidos no se pisan en la base
		favQueue = favQueue.then(() => categoryService.setFavoriteCategories(ids)).catch((err) => (notifyError(err), load()));
	}

	async function remove(kind, item) {
		if (!confirm(`¿Eliminar ${kind === 'wallet' ? 'la cuenta' : 'la categoría'} "${item.name}"?`)) return;
		try {
			await (kind === 'wallet' ? walletService.deleteWallet(item.id) : categoryService.deleteCategory(item.id));
			await load();
		} catch (err) {
			notifyError(err);
		}
	}

	// ---------- Hojas (formularios) ----------
	let walletSheet, catSheet, transferSheet;
	let wForm = $state({}), cForm = $state({}), tForm = $state({});
	let formError = $state('');
	let busy = $state(false);

	function openWallet(w = null) {
		wForm = w ? { ...w, balanceText: Number(w.balance).toLocaleString('es-CO') } : { name: '', currency: d.base, balanceText: '0', color: '#3B82F6', icon: 'ph-wallet' };
		formError = '';
		walletSheet.open();
	}
	function openCat(c = null) {
		cForm = c ? { ...c } : { name: '', type: tab, color: '#3B82F6', icon: 'ph-tag-chevron' };
		formError = '';
		catSheet.open();
	}
	function openTransfer() {
		tForm = { from: d.wallets[0].id, to: '', amountText: '' };
		tForm.to = destinations[0]?.id ?? '';
		formError = '';
		transferSheet.open();
	}
	const fromW = $derived(d?.wallets.find((w) => w.id === tForm.from));
	// Solo se ofrecen destinos en la misma moneda: el error ya no puede ocurrir
	const destinations = $derived(d && fromW ? d.wallets.filter((w) => w.id !== fromW.id && w.currency === fromW.currency) : []);

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

	const saveWallet = (e) =>
		submit(e, walletSheet, () => {
			const { id, name, color, icon, currency } = wForm;
			const data = { name: name.trim(), balance: parseCurrencyInput(wForm.balanceText), color, icon };
			return id ? walletService.updateWallet(id, data) : walletService.createWallet({ ...data, currency });
		});
	const saveCat = (e) =>
		submit(e, catSheet, () => {
			const { id, name, type, icon, color } = cForm;
			return id ? categoryService.updateCategory(id, { name: name.trim(), icon, color }) : categoryService.createCategory({ name: name.trim(), type, icon, color });
		});
	const saveTransfer = (e) =>
		submit(e, transferSheet, () => walletService.transfer({ from_wallet_id: tForm.from, to_wallet_id: tForm.to, amount: parseCurrencyInput(tForm.amountText) }));
</script>

<svelte:head><title>Billeteras · LUKA</title></svelte:head>

<div>
	<h1 class="sr-only">Billeteras</h1>
	{#if error && !d}
		<div class="alert-error" role="alert">Error al cargar datos: {error}</div>
	{:else if !d}
		{@html skeletonHtml()}
	{:else}
		<div class="wallets-module">
			<section class="section-card wallets-card" aria-labelledby="w-title">
				<div class="section-header">
					<div>
						<h3 id="w-title"><i class="ph-duotone ph-wallet" aria-hidden="true"></i> Mis Billeteras</h3>
						<p>Cuentas de donde saldrá y entrará tu dinero</p>
					</div>
					<div class="section-actions">
						{#if d.wallets.length >= 2}
							<button type="button" class="btn btn-secondary btn-sm" onclick={openTransfer}><i class="ph-bold ph-arrows-left-right" aria-hidden="true"></i> Transferir</button>
						{/if}
						<button type="button" class="btn btn-primary btn-sm" onclick={() => openWallet()}><i class="ph-bold ph-plus" aria-hidden="true"></i> Nueva</button>
					</div>
				</div>

				<div class="wallets-total">
					<span class="wallets-total-label">Saldo total disponible</span>
					<span class="wallets-total-value wallet-balance">{formatMoney(total, d.base)}</span>
					<span class="wallets-total-meta">
						{own.length} {own.length === 1 ? 'cuenta' : 'cuentas'}{own.some((w) => w.currency !== d.base) ? ` · convertido a ${d.base}` : ''}{d.cardWallets.size ? ' · sin cupos de tarjeta' : ''}
					</span>
				</div>

				{#if !d.wallets.length}
					<div class="wallets-empty">
						<i class="ph-duotone ph-wallet" aria-hidden="true"></i>
						<p>Aún no tienes billeteras. Crea la primera para empezar a registrar tu dinero.</p>
					</div>
				{:else}
					<ul class="wallets-grid" role="list">
						{#each d.wallets as w (w.id)}
							<li class="wallet-item" style:--wallet-accent={w.color} transition:slide={{ duration: 200 }}>
								<div class="wallet-item-icon" style:background-color={w.color + '1F'} style:color={w.color}><i class={resolveIconClass(w.icon)} aria-hidden="true"></i></div>
								<div class="wallet-item-info">
									<span class="wallet-name">{w.name}</span>
									<span class="wallet-balance">{formatMoney(w.balance, w.currency)}</span>
									<span class="wallet-share">
										{#if d.cardWallets.has(w.id)}Cupo disponible de tarjeta{:else}
											{w.currency !== d.base ? `≈ ${formatMoney(inBase(w), d.base)} · ` : ''}{total > 0 ? Math.round((inBase(w) / total) * 100) : 0}% del total
										{/if}
									</span>
								</div>
								<div class="wallet-actions">
									<button type="button" class="btn-edit-wallet" aria-label="Editar {w.name}" title="Editar saldo o datos" onclick={() => openWallet(w)}><i class="ph-bold ph-pencil-simple" aria-hidden="true"></i></button>
									<button type="button" class="btn-delete-wallet" aria-label="Eliminar {w.name}" title="Eliminar cuenta" onclick={() => remove('wallet', w)}><i class="ph-bold ph-trash" aria-hidden="true"></i></button>
								</div>
							</li>
						{/each}
					</ul>
				{/if}
			</section>

			<section class="section-card" aria-labelledby="c-title">
				<div class="section-header">
					<div>
						<h3 id="c-title"><i class="ph-duotone ph-tag" aria-hidden="true"></i> Categorías</h3>
						<p>{tab === 'expense' ? 'Toca la estrella para elegir tus 4 favoritas del registro rápido.' : 'Categorías para tus ingresos.'}</p>
					</div>
					<div class="section-actions">
						<button type="button" class="btn btn-secondary btn-sm" onclick={() => openCat()}><i class="ph-bold ph-plus" aria-hidden="true"></i> Nueva</button>
					</div>
				</div>

				<div class="cat-tabs-row" role="tablist">
					{#each [['expense', 'Gastos'], ['income', 'Ingresos']] as [t, label] (t)}
						<button type="button" role="tab" aria-selected={tab === t} class="cat-tab-btn" class:active={tab === t} onclick={() => ((tab = t), (showAllCats = false), (favNote = ''))}>
							{label} ({countOf(t)})
						</button>
					{/each}
				</div>

				{#if favNote}<p class="alert-info" role="status">{favNote}</p>{/if}

				<ul class="categories-selection-grid" role="list">
					{#each showAllCats ? cats : cats.slice(0, PREVIEW) as cat (cat.id)}
						{@const order = favIds.indexOf(cat.id) + 1}
						<li class="category-manage-card" class:is-selected={order > 0} transition:slide={{ duration: 200 }}>
							{#if tab === 'expense'}
								<button type="button" class="fav-badge" aria-pressed={order > 0} aria-label={order ? `Quitar ${cat.name} de favoritas` : `Fijar ${cat.name} como favorita`} onclick={() => toggleFav(cat)}>
									{#if order}#{order}{:else}<i class="ph-bold ph-star" aria-hidden="true"></i>{/if}
								</button>
							{/if}
							<div class="cat-icon-box" style:background-color={cat.color + '25'} style:color={cat.color}><i class={resolveIconClass(cat.icon)} aria-hidden="true"></i></div>
							<span class="cat-name">{cat.name}</span>
							<div class="cat-card-actions">
								<button type="button" class="btn-edit-cat" aria-label="Editar {cat.name}" onclick={() => openCat(cat)}><i class="ph-bold ph-pencil-simple" aria-hidden="true"></i></button>
								<button type="button" class="btn-delete-cat" aria-label="Eliminar {cat.name}" onclick={() => remove('cat', cat)}><i class="ph-bold ph-trash" aria-hidden="true"></i></button>
							</div>
						</li>
					{/each}
				</ul>
				{#if cats.length > PREVIEW}
					<button type="button" class="btn btn-secondary btn-block btn-sm btn-toggle-all" aria-expanded={showAllCats} onclick={() => (showAllCats = !showAllCats)}>
						<i class="ph-bold {showAllCats ? 'ph-caret-up' : 'ph-caret-down'}" aria-hidden="true"></i>
						{showAllCats ? 'Ver menos' : `Ver todas (${cats.length})`}
					</button>
				{/if}
			</section>
		</div>
	{/if}
</div>

<Sheet bind:this={walletSheet} title={wForm.id ? 'Editar billetera' : 'Nueva billetera'}>
	<form onsubmit={saveWallet}>
		<div class="form-group">
			<label for="w-name">Nombre de la cuenta</label>
			<input id="w-name" bind:value={wForm.name} placeholder="Ej. Bancolombia, Nequi, Efectivo" maxlength="40" required />
		</div>
		<div class="form-group">
			<label for="w-cur">Moneda</label>
			<select id="w-cur" bind:value={wForm.currency} disabled={!!wForm.id} aria-describedby={wForm.id ? 'w-cur-help' : undefined}>
				{#each Object.entries(CURRENCIES) as [code, c] (code)}<option value={code}>{code} · {c.name}</option>{/each}
			</select>
			{#if wForm.id}<small id="w-cur-help" class="profile-help">La moneda no se cambia después de crear la cuenta.</small>{/if}
		</div>
		<div class="form-group">
			<label for="w-bal">{wForm.id ? 'Saldo actual' : 'Saldo inicial'} ({wForm.currency})</label>
			<input id="w-bal" bind:value={wForm.balanceText} oninput={formatMoneyInput} inputmode="numeric" autocomplete="off" required />
		</div>
		<div class="form-group">
			<label for="w-color">Color</label>
			<ColorPicker id="w-color" bind:value={wForm.color} />
		</div>
		<div class="form-group">
			<span class="form-label">Icono</span>
			<IconPicker groups={[{ icons: WALLET_ICONS }]} bind:value={wForm.icon} />
		</div>
		{#if formError}<div class="alert-error" role="alert">{formError}</div>{/if}
		<button class="btn btn-primary btn-block sheet-submit" disabled={busy}>{wForm.id ? 'Guardar cambios' : 'Crear billetera'}</button>
	</form>
</Sheet>

<Sheet bind:this={catSheet} title={cForm.id ? 'Editar categoría' : 'Nueva categoría'}>
	<form onsubmit={saveCat}>
		<div class="cat-preview" aria-hidden="true">
			<div class="cat-preview-icon" style:background-color={cForm.color + '25'} style:color={cForm.color}><i class={resolveIconClass(cForm.icon)}></i></div>
			<span class="cat-preview-name">{cForm.name?.trim() || 'Nombre de la categoría'}</span>
		</div>
		<div class="form-group">
			<label for="c-name">Nombre</label>
			<input id="c-name" bind:value={cForm.name} placeholder="Ej. Cine, Ropa, Gimnasio" maxlength="30" required />
		</div>
		{#if !cForm.id}
			<div class="form-group">
				<label for="c-type">Tipo</label>
				<select id="c-type" bind:value={cForm.type}><option value="expense">Gasto</option><option value="income">Ingreso</option></select>
			</div>
		{/if}
		<div class="form-group">
			<label for="c-color">Color</label>
			<ColorPicker id="c-color" bind:value={cForm.color} />
		</div>
		<div class="form-group">
			<span class="form-label">Icono</span>
			<IconPicker groups={CATEGORY_ICON_GROUPS} bind:value={cForm.icon} />
		</div>
		{#if formError}<div class="alert-error" role="alert">{formError}</div>{/if}
		<button class="btn btn-primary btn-block sheet-submit" disabled={busy}>{cForm.id ? 'Guardar cambios' : 'Crear categoría'}</button>
	</form>
</Sheet>

<Sheet bind:this={transferSheet} title="Transferir entre cuentas">
	<form onsubmit={saveTransfer}>
		<div class="form-group">
			<label for="t-from">Sale de</label>
			<select id="t-from" bind:value={tForm.from} onchange={() => (tForm.to = destinations[0]?.id ?? '')}>
				{#each d?.wallets ?? [] as w (w.id)}<option value={w.id}>{w.name} ({formatMoney(w.balance, w.currency)})</option>{/each}
			</select>
		</div>
		<div class="form-group">
			<label for="t-to">Entra a</label>
			{#if destinations.length}
				<select id="t-to" bind:value={tForm.to}>
					{#each destinations as w (w.id)}<option value={w.id}>{w.name} ({formatMoney(w.balance, w.currency)})</option>{/each}
				</select>
			{:else}
				<p class="profile-help" id="t-to">No tienes otra cuenta en {fromW?.currency}. Por ahora solo se transfiere entre cuentas de la misma moneda.</p>
			{/if}
		</div>
		<div class="form-group">
			<label for="t-amount">Monto ({fromW?.currency})</label>
			<input id="t-amount" bind:value={tForm.amountText} oninput={formatMoneyInput} inputmode="numeric" placeholder="Ej. 150.000" autocomplete="off" required aria-describedby="t-help" />
			<small id="t-help" class="profile-help">Mueve el saldo sin contarlo como gasto ni ingreso del mes.</small>
		</div>
		{#if formError}<div class="alert-error" role="alert">{formError}</div>{/if}
		<button class="btn btn-primary btn-block sheet-submit" disabled={busy || !destinations.length}>Confirmar transferencia</button>
	</form>
</Sheet>
