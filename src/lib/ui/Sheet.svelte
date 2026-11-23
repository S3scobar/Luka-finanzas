<script>
	// Hoja de vidrio con <dialog> nativo: Esc, Atrás y tocar fuera la cierran; el foco vuelve solo.
	/** @type {{ title: string, children: import('svelte').Snippet }} */
	let { title, children } = $props();
	let dialog;
	const id = `sheet-${Math.random().toString(36).slice(2, 8)}`;

	export const open = () => dialog.showModal();
	export const close = () => dialog.close();
</script>

<dialog bind:this={dialog} class="modal-content sheet" aria-labelledby={id} closedby="any">
	<div class="modal-header">
		<h1 {id}>{title}</h1>
		<form method="dialog"><button class="modal-close-btn" aria-label="Cerrar">&times;</button></form>
	</div>
	{@render children()}
</dialog>
