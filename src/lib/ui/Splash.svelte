<script>
	// Pantalla de apertura: está en el HTML prerenderizado y la anima CSS (splash.css).
	// boot.js decide si se muestra (clase splash-on); aquí solo se salta y se retira.
	import { onMount } from 'svelte';

	let gone = $state(false);
	let skip = $state(false);

	function finish() {
		document.documentElement.classList.remove('splash-on');
		gone = true;
	}

	onMount(() => {
		if (!document.documentElement.classList.contains('splash-on')) {
			gone = true;
			return;
		}
		const onKey = () => (skip = true);
		document.addEventListener('keydown', onKey, { once: true });
		const timer = setTimeout(finish, 5000); // seguro si no llega animationend
		return () => {
			clearTimeout(timer);
			document.removeEventListener('keydown', onKey);
		};
	});
</script>

{#if !gone}
	<div
		id="splash"
		class:splash-skip={skip}
		aria-hidden="true"
		onpointerdown={() => (skip = true)}
		onanimationend={(e) => e.target === e.currentTarget && e.animationName === 'splash-out' && finish()}
	>
		<div class="splash-bg">
			<i class="blob b1"></i><i class="blob b2"></i><i class="blob b3"></i>
		</div>
		<div class="splash-stage">
			<div class="splash-glass">
				<span class="splash-sheen"></span>
				<!-- El símbolo se arma por piezas, como lo explica el manual: asta, base que acelera y punto -->
				<svg class="splash-mark" viewBox="128 116 268 280">
					<path class="m-stem" d="M148 136H228V376H148Z" />
					<path class="m-base" d="M228 300H376L300 376H228Z" />
					<circle class="m-dot" cx="356" cy="156" r="26" />
				</svg>
			</div>
			<div class="splash-word"><span>L</span><span>U</span><span>K</span><span>A</span></div>
			<p class="splash-tag">Tu plata, <em>clara.</em></p>
		</div>
	</div>
{/if}
