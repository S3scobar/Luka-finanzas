<script>
	// Ahorros (antes views/savingsView.js): fondos con meta, aportes, retiros, racha y rendimientos.
	import { onMount } from 'svelte';
	import { flip } from 'svelte/animate';
	import { fly } from 'svelte/transition';
	import { goalService } from '#lib/services/goalService.js';
	import { walletService } from '#lib/services/walletService.js';
	import { formatMoney } from '#lib/services/currencyService.js';
	import { parseCurrencyInput, formatMoneyInput } from '#lib/currencyFormatter.js';
	import { SAVING_ICONS, resolveIconClass } from '#lib/icons.js';
	import { savingStreak, monthlyNeeded, monthlyYield, crossedMilestone } from '#lib/savings.js';
	import { notifyError } from '#lib/utils.js';
	import { skeletonHtml } from '#lib/components/skeleton.js';
	import Sheet from '#lib/ui/Sheet.svelte';
	import IconPicker from '#lib/ui/IconPicker.svelte';

	const now = new Date();
	const cop = (n) => Math.round(n).toLocaleString('es-CO');
	const monthName = (iso) => new Date(`${String(iso).slice(0, 7)}-15`).toLocaleDateString('es-CO', { month: 'short', year: 'numeric' }).replace('.', '');
	// Plantillas para empezar con un toque (vacío y botón Nuevo)
	const TEMPLATES = [
		{ title: 'Fondo de emergencia', icon: 'ph-shield-check', target: 3000000 },
		{ title: 'Viaje', icon: 'ph-airplane-tilt', target: 2000000 },
		{ title: 'Cajita con rendimiento', icon: 'ph-bank', target: 1000000, yield: 9 },
		{ title: 'Celular nuevo', icon: 'ph-device-mobile', target: 1500000 }
	];

	let d = $state(null);
	let error = $state('');

	async function load() {
		try {
			const [goals, wallets, dates] = await Promise.all([
				goalService.getGoals(),
				walletService.getWallets(),
				goalService.getContributionDates().catch(() => []) // la racha es un extra: sin ella la pestaña sigue
			]);
			d = { goals: goals || [], wallets: wallets || [], dates };
			error = '';
		} catch (err) {
			error = err?.message || 'Error desconocido';
		}
	}
	onMount(load);

	const funds = $derived(
		(d?.goals ?? []).map((g) => {
			const current = Number(g.current_amount) || 0, target = Number(g.target_amount) || 0;
			return {
				...g,
				current,
				target,
				pct: target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0,
				done: target > 0 && current >= target,
				need: monthlyNeeded(current, target, g.target_date, now),
				gain: monthlyYield(current, Number(g.yield_rate))
			};
		})
	);
	const total = $derived(funds.reduce((s, f) => s + f.current, 0));
	const goalSum = $derived(funds.reduce((s, f) => s + Math.max(f.target, f.current), 0));
	const gain = $derived(funds.reduce((s, f) => s + f.gain, 0));
	const streak = $derived(savingStreak(d?.dates ?? [], now));

	// ---------- Hoja del fondo (crear / editar / eliminar) ----------
	let fundSheet, moveSheet;
	let f = $state({});
	let formError = $state('');
	let busy = $state(false);

	function openFund(g = null, tpl = null) {
		f = g
			? { id: g.id, title: g.title, icon: g.icon || 'ph-piggy-bank', targetText: cop(g.target), month: g.target_date?.slice(0, 7) ?? '', yield: g.yield_rate || '', current: g.current, askDelete: false, wallet_id: d.wallets[0]?.id }
			: { title: tpl?.title ?? '', icon: tpl?.icon ?? 'ph-piggy-bank', targetText: tpl ? cop(tpl.target) : '', month: '', yield: tpl?.yield ?? '', initialText: '', wallet_id: d.wallets[0]?.id };
		formError = '';
		fundSheet.open();
	}

	async function run(sheet, action) {
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

	function saveFund(e) {
		e.preventDefault();
		run(fundSheet, () => {
			const target_amount = parseCurrencyInput(f.targetText);
			if (target_amount <= 0) throw new Error('Ponle una meta mayor a 0: así LUKA te dice cuánto te falta.');
			const data = { title: f.title, target_amount, target_date: f.month ? `${f.month}-01` : null, icon: f.icon, yield_rate: Number(f.yield) || 0 };
			if (f.id) return goalService.updateGoal(f.id, data);
			const current_amount = parseCurrencyInput(f.initialText);
			return goalService.createGoal({ ...data, current_amount, wallet_id: current_amount > 0 ? f.wallet_id : null });
		});
	}

	// Con dinero dentro, eliminar sin más lo perdería: se ofrece pasarlo antes a una cuenta
	const removeFund = (withdrawFirst) =>
		run(fundSheet, async () => {
			if (withdrawFirst && f.current > 0) await goalService.withdrawFromGoal(f.id, f.current, f.wallet_id);
			await goalService.deleteGoal(f.id);
		});

	// ---------- Hoja de aporte / retiro ----------
	let celebrate = $state(null); // { id, pct } durante unos segundos tras cruzar un hito

	function openMove(fund, mode) {
		f = { fund, mode, amountText: '', wallet_id: d.wallets[0]?.id };
		formError = '';
		moveSheet.open();
	}
	const moveAmount = $derived(f.mode ? parseCurrencyInput(f.amountText) : 0);
	const after = $derived(f.fund ? Math.max(0, f.fund.current + (f.mode === 'add' ? moveAmount : -moveAmount)) : 0);
	const chips = $derived.by(() => {
		if (!f.fund) return [];
		if (f.mode === 'out') return [['Todo', f.fund.current], ['La mitad', Math.round(f.fund.current / 2)]].filter(([, v]) => v > 0);
		const left = f.fund.target - f.fund.current;
		const list = [[`$ ${cop(10000)}`, 10000], [`$ ${cop(50000)}`, 50000], [`$ ${cop(100000)}`, 100000]];
		if (f.fund.need?.perMonth > 0) list.unshift(['Cuota del mes', f.fund.need.perMonth]);
		if (left > 0) list.push(['Completar meta', left]);
		return list;
	});

	function saveMove(e) {
		e.preventDefault();
		const { fund, mode } = f;
		const amount = moveAmount;
		run(moveSheet, async () => {
			if (amount <= 0) throw new Error('Ingresa un valor mayor a 0.');
			if (mode === 'out') {
				if (amount > fund.current) throw new Error(`Solo tienes ${formatMoney(fund.current)} en este fondo.`);
				return goalService.withdrawFromGoal(fund.id, amount, f.wallet_id);
			}
			await goalService.contributeToGoal(fund.id, amount, f.wallet_id);
			const hit = crossedMilestone(fund.current, fund.current + amount, fund.target);
			if (hit) {
				celebrate = { id: fund.id, pct: hit };
				navigator.vibrate?.([18, 40, 18]);
				setTimeout(() => (celebrate = null), 4200);
			}
		});
	}
</script>

<svelte:head><title>Ahorros · LUKA</title></svelte:head>

<div>
	<h1 class="sr-only">Ahorros</h1>
	{#if error && !d}
		<div class="alert-error" role="alert">Error al cargar ahorros: {error}</div>
	{:else if !d}
		{@html skeletonHtml()}
	{:else}
		<div class="savings-module">
			{#if funds.length}
			<section class="budget-hero-card sv-hero" aria-label="Resumen de tus ahorros">
				<div class="budget-hero-top">
					<span class="budget-hero-badge"><i class="ph-bold ph-vault" aria-hidden="true"></i> Tu ahorro</span>
					{#if streak.months}
						<span class="sv-streak" class:is-risk={!streak.savedThisMonth} title="Meses seguidos con al menos un aporte">
							<i class="ph-duotone ph-fire" aria-hidden="true"></i> {streak.months} {streak.months === 1 ? 'mes' : 'meses'}
						</span>
					{/if}
				</div>
				<div class="budget-hero-amount-row">
					<span class="budget-hero-spent">{formatMoney(total)}</span>
					<span class="budget-hero-limit">en {funds.length} {funds.length === 1 ? 'fondo' : 'fondos'}</span>
				</div>
				{#if goalSum > 0}
					{@const all = Math.min(100, Math.round((total / goalSum) * 100))}
					<div class="budget-hero-progress-track" role="progressbar" aria-valuenow={all} aria-valuemin="0" aria-valuemax="100" aria-label="{all}% de todas tus metas">
						<div class="budget-hero-progress-fill sv-fill" style:width="{all}%"></div>
					</div>
					<div class="budget-hero-footer">
						<span>{all}% de todas tus metas</span>
						<span>Faltan {formatMoney(Math.max(0, goalSum - total))}</span>
					</div>
				{/if}
				{#if gain >= 1 || (streak.months && !streak.savedThisMonth) || (!streak.months && funds.length)}
					<ul class="sv-facts" role="list">
						{#if gain >= 1}<li><i class="ph-bold ph-trend-up text-success" aria-hidden="true"></i> Tus rendimientos suman ≈ <strong>{formatMoney(gain)}</strong> este mes sin hacer nada</li>{/if}
						{#if streak.months && !streak.savedThisMonth}
							<li><i class="ph-bold ph-hourglass-medium" aria-hidden="true"></i> Aporta este mes para no perder tu racha de {streak.months} {streak.months === 1 ? 'mes' : 'meses'}</li>
						{:else if !streak.months && funds.length}
							<li><i class="ph-bold ph-fire" aria-hidden="true"></i> Haz un aporte este mes y empieza tu racha de ahorro</li>
						{/if}
					</ul>
				{/if}
			</section>
			{/if}

			<section class="section-card" aria-labelledby="sv-title">
				<div class="section-header">
					<div>
						<h3 id="sv-title"><i class="ph-duotone ph-piggy-bank" aria-hidden="true"></i> Tus fondos</h3>
						<p>Cada aporte sale de una cuenta y se registra como gasto de ahorro.</p>
					</div>
					<button type="button" class="btn btn-primary btn-sm" onclick={() => openFund()}><i class="ph-bold ph-plus" aria-hidden="true"></i> Nuevo</button>
				</div>

				{#if !funds.length}
					<div class="empty-state sv-empty">
						<i class="ph-duotone ph-plant empty-icon" aria-hidden="true"></i>
						<p>Empieza con una meta. Toca una idea:</p>
						<div class="sv-templates">
							{#each TEMPLATES as t (t.title)}
								<button type="button" class="sv-tpl" onclick={() => openFund(null, t)}>
									<i class={resolveIconClass(t.icon)} aria-hidden="true"></i> {t.title}
								</button>
							{/each}
						</div>
					</div>
				{:else}
					<ul class="sv-grid" role="list">
						{#each funds as g (g.id)}
							<li animate:flip={{ duration: 250 }}>
								<article class="sv-card" class:is-done={g.done} aria-labelledby="fund-{g.id}">
									{#if celebrate?.id === g.id}
										<div class="sv-party" role="status" transition:fly={{ y: -8, duration: 260 }}>
											<span class="sv-confetti" aria-hidden="true">{#each Array(12) as _, i (i)}<i style:--i={i}></i>{/each}</span>
											<i class="ph-duotone ph-confetti" aria-hidden="true"></i>
											{celebrate.pct === 100 ? '¡Meta cumplida!' : `¡Llegaste al ${celebrate.pct}%!`}
										</div>
									{/if}
									<div class="sv-top">
										<span class="sv-icon"><i class={resolveIconClass(g.icon || 'ph-piggy-bank')} aria-hidden="true"></i></span>
										<div class="sv-title">
											<h4 id="fund-{g.id}">{g.title}</h4>
											<div class="sv-tags">
												{#if g.done}<span class="sv-tag is-done"><i class="ph-bold ph-check-circle" aria-hidden="true"></i> Cumplida</span>{/if}
												{#if Number(g.yield_rate) > 0}<span class="sv-tag is-yield"><i class="ph-bold ph-trend-up" aria-hidden="true"></i> {Number(g.yield_rate).toLocaleString('es-CO')}% E.A.</span>{/if}
												{#if g.target_date && !g.done}<span class="sv-tag"><i class="ph-bold ph-calendar-blank" aria-hidden="true"></i> {monthName(g.target_date)}</span>{/if}
											</div>
										</div>
										<button type="button" class="loan-icon-btn" aria-label="Editar {g.title}" onclick={() => openFund(g)}><i class="ph-bold ph-dots-three" aria-hidden="true"></i></button>
									</div>

									<p class="sv-amount"><strong>{formatMoney(g.current)}</strong> <span>de {formatMoney(g.target)}</span></p>
									<div class="sv-bar" role="progressbar" aria-valuenow={g.pct} aria-valuemin="0" aria-valuemax="100" aria-label="{g.pct}% de la meta">
										<span class="sv-bar-fill" style:width="{g.pct}%"></span>
										{#each [25, 50, 75] as m (m)}<span class="sv-tick" class:is-passed={g.pct >= m} style:left="{m}%"></span>{/each}
									</div>
									<p class="sv-next">
										{#if g.done}
											¡Lo lograste! ¿Subimos la meta?
										{:else}
											<strong>{g.pct}%</strong> · te faltan {formatMoney(g.target - g.current)}
											{#if g.need}<br /><span class:is-late={g.need.months === 0}>{g.need.months === 0 ? 'La fecha ya pasó: ajústala o completa hoy' : `Ahorra ${formatMoney(g.need.perMonth)} al mes y lo logras`}</span>{/if}
										{/if}
										{#if g.gain >= 1}<br /><span class="text-success">+≈ {formatMoney(g.gain)} al mes en rendimientos</span>{/if}
									</p>

									<div class="sv-actions">
										<button type="button" class="btn btn-primary btn-sm" onclick={() => openMove(g, 'add')}><i class="ph-bold ph-plus-circle" aria-hidden="true"></i> Aportar</button>
										<button type="button" class="btn btn-secondary btn-sm" onclick={() => openMove(g, 'out')} disabled={g.current <= 0}><i class="ph-bold ph-arrow-up-right" aria-hidden="true"></i> Retirar</button>
									</div>
								</article>
							</li>
						{/each}
					</ul>
				{/if}
			</section>
		</div>
	{/if}
</div>

<Sheet bind:this={fundSheet} title={f.id ? 'Editar fondo' : 'Nuevo fondo'}>
	{#if f.askDelete}
		<div class="sv-delete">
			{#if f.current > 0}
				<p>Este fondo tiene <strong>{formatMoney(f.current)}</strong>. ¿Qué hacemos con ese dinero?</p>
				<div class="form-group">
					<label for="fd-wallet">Pasarlo a</label>
					<select id="fd-wallet" bind:value={f.wallet_id}>{#each d?.wallets ?? [] as w (w.id)}<option value={w.id}>{w.name} ({formatMoney(w.balance, w.currency)})</option>{/each}</select>
				</div>
				{#if formError}<div class="alert-error" role="alert">{formError}</div>{/if}
				<button type="button" class="btn btn-primary btn-block sheet-submit" disabled={busy} onclick={() => removeFund(true)}>Pasar a la cuenta y eliminar</button>
				<button type="button" class="btn btn-secondary btn-block text-danger sv-lose" disabled={busy} onclick={() => removeFund(false)}>Eliminar sin devolver el dinero</button>
			{:else}
				<p>¿Eliminar <strong>{f.title}</strong>? Tus aportes pasados siguen en tu historial.</p>
				{#if formError}<div class="alert-error" role="alert">{formError}</div>{/if}
				<button type="button" class="btn btn-primary btn-block sheet-submit" disabled={busy} onclick={() => removeFund(false)}>Eliminar fondo</button>
			{/if}
			<button type="button" class="btn btn-secondary btn-block sv-lose" onclick={() => (f.askDelete = false)}>Cancelar</button>
		</div>
	{:else}
		<form onsubmit={saveFund}>
			<div class="form-group"><label for="fd-name">Nombre</label><input id="fd-name" bind:value={f.title} placeholder="Ej. Fondo de emergencia, Cajita Nu" maxlength="40" required /></div>
			<div class="form-grid-2">
				<div class="form-group"><label for="fd-target">Meta</label><input id="fd-target" bind:value={f.targetText} oninput={formatMoneyInput} inputmode="numeric" placeholder="1.000.000" required /></div>
				<div class="form-group"><label for="fd-month">¿Para cuándo? <small>(opcional)</small></label><input id="fd-month" type="month" bind:value={f.month} min={now.toLocaleDateString('en-CA').slice(0, 7)} /></div>
			</div>
			{#if !f.id}
				<div class="form-group">
					<label for="fd-init">Ya tengo ahorrado <small>(opcional)</small></label>
					<input id="fd-init" bind:value={f.initialText} oninput={formatMoneyInput} inputmode="numeric" placeholder="0" />
				</div>
				{#if parseCurrencyInput(f.initialText) > 0}
					<div class="form-group">
						<label for="fd-from">Sale de</label>
						<select id="fd-from" bind:value={f.wallet_id}>{#each d?.wallets ?? [] as w (w.id)}<option value={w.id}>{w.name} ({formatMoney(w.balance, w.currency)})</option>{/each}</select>
						<small class="profile-help">Se descuenta de esa cuenta y queda como gasto de ahorro.</small>
					</div>
				{/if}
			{/if}
			<div class="form-group">
				<label for="fd-yield">Rendimiento anual (% E.A.) <small>(opcional)</small></label>
				<input id="fd-yield" type="number" bind:value={f.yield} min="0" max="100" step="0.1" inputmode="decimal" placeholder="Ej. 9 para una cajita" aria-describedby="fd-yield-help" />
				<small id="fd-yield-help" class="profile-help">Si genera intereses, tu saldo crece solo cada día.</small>
			</div>
			<fieldset class="form-group sv-icons"><legend>Icono</legend><IconPicker groups={[{ icons: SAVING_ICONS }]} bind:value={f.icon} /></fieldset>
			{#if formError}<div class="alert-error" role="alert">{formError}</div>{/if}
			<button class="btn btn-primary btn-block sheet-submit" disabled={busy}>{f.id ? 'Guardar cambios' : 'Crear fondo'}</button>
			{#if f.id}<button type="button" class="btn btn-secondary btn-block text-danger sv-lose" onclick={() => ((f.askDelete = true), (formError = ''))}><i class="ph-bold ph-trash" aria-hidden="true"></i> Eliminar fondo</button>{/if}
		</form>
	{/if}
</Sheet>

<Sheet bind:this={moveSheet} title={f.mode === 'out' ? `Retirar de ${f.fund?.title ?? ''}` : `Aportar a ${f.fund?.title ?? ''}`}>
	<form onsubmit={saveMove}>
		<div class="form-group">
			<label for="mv-amt">{f.mode === 'out' ? '¿Cuánto retiras?' : '¿Cuánto guardas?'}</label>
			<input id="mv-amt" class="sv-big" bind:value={f.amountText} oninput={formatMoneyInput} inputmode="numeric" placeholder="0" required />
			<div class="sv-chips">
				{#each chips as [label, v] (label)}
					<button type="button" class="sv-chip" onclick={() => (f.amountText = cop(v))}>{label}</button>
				{/each}
			</div>
		</div>
		{#if f.fund && moveAmount > 0}
			{@const pa = f.fund.target > 0 ? Math.min(100, Math.round((after / f.fund.target) * 100)) : 0}
			<div class="sv-preview" class:is-out={f.mode === 'out'}>
				<span>Quedarías en <strong>{formatMoney(after)}</strong> · {f.fund.pct}% → {pa}%</span>
				<span class="sv-bar"><span class="sv-bar-fill" style:width="{pa}%"></span></span>
			</div>
		{/if}
		<div class="form-group">
			<label for="mv-wallet">{f.mode === 'out' ? 'Entra a' : 'Sale de'}</label>
			<select id="mv-wallet" bind:value={f.wallet_id} required>{#each d?.wallets ?? [] as w (w.id)}<option value={w.id}>{w.name} ({formatMoney(w.balance, w.currency)})</option>{/each}</select>
			<small class="profile-help">{f.mode === 'out' ? 'Se suma a esa cuenta como ingreso.' : 'Se descuenta de esa cuenta y queda como gasto de ahorro.'}</small>
		</div>
		{#if formError}<div class="alert-error" role="alert">{formError}</div>{/if}
		<button class="btn btn-primary btn-block sheet-submit" disabled={busy}>{f.mode === 'out' ? 'Retirar' : 'Guardar aporte'}</button>
	</form>
</Sheet>

<style>
	.sv-hero { display: grid; }
	.sv-streak {
		display: inline-flex; align-items: center; gap: 0.3rem; padding: 0.2rem 0.6rem; border-radius: 999px;
		font-size: var(--fs-sm); font-weight: 700; color: #c2410c; background: rgb(249 115 22 / 0.12);
	}
	.sv-streak.is-risk { color: var(--text-muted); background: var(--bg-hover); }
	.sv-fill { background: linear-gradient(90deg, #34d399, var(--success)); }
	.sv-facts { list-style: none; margin: 0.85rem 0 0; padding: 0.75rem 0 0; border-top: 1px solid var(--border); display: grid; gap: 0.45rem; font-size: var(--fs-md); color: var(--text-secondary); }
	.sv-facts li { padding-left: 1.5rem; text-indent: -1.5rem; }
	.sv-facts i { width: 1.5rem; text-indent: 0; display: inline-block; }
	.sv-facts strong { color: var(--text-main); }

	.sv-grid { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.85rem; grid-template-columns: repeat(auto-fill, minmax(min(100%, 280px), 1fr)); }
	.sv-card {
		position: relative; height: 100%; display: grid; gap: 0.6rem; padding: 1rem 1.05rem; border-radius: 20px;
		background: var(--g-card, var(--bg-card)); border: 1px solid var(--g-edge, var(--border));
		box-shadow: inset 0 1px 0 var(--g-edge, transparent), 0 6px 18px -12px rgb(15 23 42 / 0.25);
	}
	.sv-card.is-done { border-color: color-mix(in srgb, var(--success) 45%, transparent); }
	.sv-top { display: flex; align-items: flex-start; gap: 0.7rem; }
	.sv-icon { display: grid; place-items: center; width: 42px; height: 42px; flex: none; border-radius: 13px; font-size: 1.3rem; color: var(--primary); background: var(--primary-soft); }
	.is-done .sv-icon { color: var(--success); background: var(--success-soft); }
	.sv-title { flex: 1; min-width: 0; }
	.sv-title h4 { margin: 0; font-size: 1rem; font-weight: 700; color: var(--text-main); overflow-wrap: anywhere; }
	.sv-tags { display: flex; flex-wrap: wrap; gap: 0.3rem; margin-top: 0.25rem; }
	.sv-tag { display: inline-flex; align-items: center; gap: 0.25rem; padding: 0.1rem 0.45rem; border-radius: 999px; font-size: var(--fs-2xs); font-weight: 700; color: var(--text-muted); background: var(--bg-hover); }
	.sv-tag.is-yield { color: var(--success-text); background: var(--success-soft); }
	.sv-tag.is-done { color: var(--success-text); background: var(--success-soft); }

	.sv-amount { margin: 0; font-variant-numeric: tabular-nums; }
	.sv-amount strong { font-size: 1.45rem; font-weight: 800; letter-spacing: -0.02em; color: var(--text-main); }
	.sv-amount span { font-size: var(--fs-md); color: var(--text-muted); }
	.sv-bar { position: relative; display: block; height: 10px; border-radius: 999px; background: var(--border); overflow: hidden; }
	.sv-bar-fill { display: block; height: 100%; border-radius: inherit; background: linear-gradient(90deg, var(--primary), #34d399); transition: width 0.6s var(--g-spring, ease); }
	.is-done .sv-bar-fill { background: var(--success); }
	.sv-tick { position: absolute; top: 2px; bottom: 2px; width: 2px; translate: -1px 0; border-radius: 2px; background: rgb(255 255 255 / 0.7); }
	.sv-tick:not(.is-passed) { background: color-mix(in srgb, var(--text-muted) 35%, transparent); }
	.sv-next { margin: 0; font-size: var(--fs-sm); line-height: 1.5; color: var(--text-muted); }
	.sv-next strong { color: var(--text-main); }
	.sv-next .is-late { color: var(--danger); font-weight: 600; }
	.sv-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; margin-top: 0.15rem; }
	.sv-actions .btn { min-height: 44px; }

	/* Celebración al cruzar 25/50/75/100 % */
	.sv-party {
		position: absolute; inset: 0.5rem 0.5rem auto; z-index: 2; display: flex; align-items: center; justify-content: center; gap: 0.45rem;
		padding: 0.55rem; border-radius: 14px; font-weight: 800; color: #fff;
		background: linear-gradient(135deg, #10b981, #2563eb); box-shadow: 0 10px 24px -10px rgb(16 185 129 / 0.7);
	}
	.sv-confetti { position: absolute; inset: 0; pointer-events: none; overflow: visible; }
	.sv-confetti i {
		position: absolute; top: 50%; left: 50%; width: 6px; height: 10px; border-radius: 2px;
		background: hsl(calc(var(--i) * 30) 90% 60%);
		animation: sv-pop 1.1s cubic-bezier(0.2, 0.7, 0.3, 1) forwards;
		--a: calc(var(--i) * 30deg);
	}
	@keyframes sv-pop {
		from { transform: rotate(var(--a)) translateY(0) scale(1); opacity: 1; }
		to { transform: rotate(var(--a)) translateY(-70px) rotate(200deg) scale(0.6); opacity: 0; }
	}

	.sv-empty p { margin-bottom: 0.9rem; }
	.sv-templates { display: flex; flex-wrap: wrap; justify-content: center; gap: 0.5rem; }
	.sv-tpl, .sv-chip {
		display: inline-flex; align-items: center; gap: 0.4rem; min-height: 40px; padding: 0 0.9rem; border-radius: 999px;
		font: inherit; font-size: var(--fs-md); font-weight: 600; color: var(--text-main); cursor: pointer;
		background: var(--g-chip, var(--bg-card)); border: 1px solid var(--g-edge, var(--border));
		transition: transform 0.25s var(--g-spring, ease), background-color 0.2s ease;
	}
	.sv-tpl:hover, .sv-chip:hover { background: var(--g-chip-hover, var(--bg-hover)); }
	.sv-tpl:active, .sv-chip:active { transform: scale(0.95); }
	.sv-tpl i { color: var(--primary); font-size: var(--fs-lg); }

	.sv-big { font-size: 1.5rem !important; font-weight: 700; font-variant-numeric: tabular-nums; }
	.sv-chips { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-top: 0.55rem; }
	.sv-chip { min-height: 36px; padding: 0 0.75rem; font-size: var(--fs-sm); }
	.sv-preview { display: grid; gap: 0.4rem; margin: 0 0 1rem; padding: 0.7rem 0.8rem; border-radius: 14px; font-size: var(--fs-md); color: var(--text-secondary); background: var(--success-soft); }
	.sv-preview.is-out { background: var(--warning-soft); }
	.sv-preview strong { color: var(--text-main); }
	.sv-preview .sv-bar { height: 6px; }
	.sv-icons { border: 0; padding: 0; margin-inline: 0; }
	.sv-icons legend { padding: 0; margin-bottom: 0.4rem; font-weight: 600; font-size: 0.875rem; }
	.sv-delete p { margin: 0 0 1rem; color: var(--text-secondary); }
	.sv-lose { margin-top: 0.6rem; }
	label small { font-weight: 500; color: var(--text-muted); }

	@media (prefers-reduced-motion: reduce) {
		.sv-confetti { display: none; }
		.sv-bar-fill, .sv-tpl, .sv-chip { transition: none; }
	}
</style>
