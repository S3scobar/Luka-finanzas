<script>
	import { LEGAL } from '#lib/legal.js';

	/** @type {{ title: string, description: string, sections: { id: string, title: string }[], children: import('svelte').Snippet }} */
	let { title, description, sections, children } = $props();
</script>

<svelte:head>
	<title>{title} · {LEGAL.app}</title>
	<meta name="description" content={description} />
</svelte:head>

<article class="legal section-card">
	<header class="legal-head">
		<a class="legal-back" href="/"><i class="ph-bold ph-arrow-left" aria-hidden="true"></i> Volver a {LEGAL.app}</a>
		<h1>{title}</h1>
		<p class="legal-meta">Última actualización: <time>{LEGAL.updated}</time></p>
	</header>

	<nav class="legal-toc" aria-label="Contenido">
		<ol>
			{#each sections as s (s.id)}<li><a href="#{s.id}">{s.title}</a></li>{/each}
		</ol>
	</nav>

	<div class="legal-body">
		{@render children()}
	</div>
</article>
