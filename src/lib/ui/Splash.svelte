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
		<div class="splash-bg"></div>
		<div class="splash-stage">
			<div class="splash-ripple"></div>
			<div class="splash-ripple r2"></div>
			<svg class="splash-ring" viewBox="0 0 200 200"><circle cx="100" cy="100" r="92" /></svg>
			<img class="splash-logo" src="/favicon.svg" alt="" />
			<div class="splash-word"><span>L</span><span>U</span><span>K</span><span>A</span></div>
			<p class="splash-tag">Tus finanzas, <em>bajo control.</em></p>
		</div>
	</div>
{/if}
