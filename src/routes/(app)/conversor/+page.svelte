<script>
	// Conversor de moneda y moneda base de la cuenta: primera vista nativa en Svelte (sin innerHTML).
	import { onMount } from 'svelte';
	import {
		getRates,
		getBaseCurrency,
		setBaseCurrency,
		convert,
		formatMoney,
		CURRENCIES
	} from '#lib/services/currencyService.js';
	import { notifyError } from '#lib/utils.js';
	import { skeletonHtml } from '#lib/components/skeleton.js';

	const SOURCE_NOTE = {
		live: 'Tasas actualizadas ahora.',
		cache: 'Tasas guardadas en tu dispositivo (se renuevan cada 6 horas).',
		fallback: 'Sin conexión: se usan tasas aproximadas. Conéctate para ver las reales.'
	};
	const codes = Object.keys(CURRENCIES);
	// Se omite el COP como origen: 1 peso en dólares o euros daría 0,00
	const pairs = codes.filter((a) => a !== 'COP').flatMap((a) => codes.filter((b) => b !== a).map((b) => [a, b]));

	let data = $state(null);
	let error = $state('');
	let from = $state('USD');
	let to = $state('COP');
	let amount = $state(1);
	let base = $state('COP');

	const amountText = $derived(amount ? amount.toLocaleString('es-CO') : '');
	const result = $derived(data ? convert(amount, from, to, data.rates) : 0);

	onMount(async () => {
		try {
			const [rates, baseCurrency] = await Promise.all([getRates(), getBaseCurrency()]);
			data = rates;
			base = baseCurrency;
		} catch (err) {
			error = err?.message || 'Error desconocido';
		}
	});

	function onAmount(e) {
		amount = Number(e.currentTarget.value.replace(/\D/g, '')) || 0;
		e.currentTarget.value = amountText; // mantiene los separadores de miles al escribir
	}

	async function onBase(e) {
		const previous = base;
		base = e.currentTarget.value;
		try {
			await setBaseCurrency(base);
		} catch (err) {
			base = previous;
			notifyError(err);
		}
	}

	const shortDate = (ts) => new Date(ts).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
</script>

<svelte:head><title>Conversor · LUKA</title></svelte:head>

<div>
	<h1 class="sr-only">Conversor</h1>
	{#if error}
		<div class="alert-error" role="alert">Error al cargar el conversor: {error}</div>
	{:else if !data}
		{@html skeletonHtml()}
	{:else}
		<div class="converter-module">
			<section class="section-card" aria-labelledby="fx-title">
				<div class="section-header">
					<div>
						<h3 id="fx-title"><i class="ph-duotone ph-currency-circle-dollar" aria-hidden="true"></i> Conversor de moneda</h3>
						<p>{SOURCE_NOTE[data.source]}{data.updatedAt ? ` Datos del ${shortDate(data.updatedAt)}.` : ''}</p>
					</div>
				</div>

				<div class="form-group">
					<label for="fx-amount">Monto</label>
					<input id="fx-amount" type="text" inputmode="numeric" autocomplete="off" value={amountText} oninput={onAmount} />
				</div>
				<div class="converter-row">
					<select bind:value={from} aria-label="De">
						{#each codes as code (code)}<option value={code}>{code}</option>{/each}
					</select>
					<button type="button" class="btn btn-secondary btn-sm" aria-label="Invertir monedas" onclick={() => ([from, to] = [to, from])}>
						<i class="ph-bold ph-arrows-left-right" aria-hidden="true"></i>
					</button>
					<select bind:value={to} aria-label="A">
						{#each codes as code (code)}<option value={code}>{code}</option>{/each}
					</select>
				</div>
				<div class="converter-result" aria-live="polite">
					<span class="converter-from">{formatMoney(amount, from)} =</span>
					<span class="converter-to">{formatMoney(result, to)}</span>
				</div>
			</section>

			<section class="section-card" aria-labelledby="fx-rates">
				<div class="section-header">
					<div>
						<h3 id="fx-rates"><i class="ph-duotone ph-chart-line-up" aria-hidden="true"></i> Tasas de hoy</h3>
					</div>
				</div>
				<div class="converter-rates">
					{#each pairs as [a, b] (a + b)}
						<div class="converter-rate"><span>1 {a}</span><strong>{formatMoney(convert(1, a, b, data.rates), b)}</strong></div>
					{/each}
				</div>
			</section>

			<section class="section-card" aria-labelledby="fx-base-title">
				<div class="section-header">
					<div>
						<h3 id="fx-base-title"><i class="ph-duotone ph-coins" aria-hidden="true"></i> Moneda base</h3>
						<p>Tus totales (saldo, ingresos y gastos) se muestran en esta moneda, aunque tengas cuentas en otras.</p>
					</div>
				</div>
				<select id="fx-base" value={base} onchange={onBase} aria-labelledby="fx-base-title">
					{#each Object.entries(CURRENCIES) as [code, c] (code)}<option value={code}>{code} · {c.name}</option>{/each}
				</select>
			</section>
		</div>
	{/if}
</div>
