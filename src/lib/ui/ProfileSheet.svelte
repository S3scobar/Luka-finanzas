<script>
	// Perfil: nombre, celular, contraseña, Face ID, avisos y cerrar sesión.
	import { onMount } from 'svelte';
	import { supabase } from '#lib/supabaseClient.js';
	import { authService } from '#lib/services/authService.js';
	import { biometricService } from '#lib/services/biometricService.js';
	import { notificationService } from '#lib/services/notificationService.js';
	import { session } from '#lib/session.svelte.js';

	/** @type {{ onlogout: () => void }} */
	let { onlogout } = $props();

	let dialog;
	let user = $state(null);
	let phone = $state('');
	let name = $state('');
	let msg = $state({ name: '', phone: '', pass: '' });
	let busy = $state('');
	let bioOn = $state(false);
	let bioSupported = $state(false);
	let notif = $state('default');

	const isPhoneLogin = $derived(user?.email?.endsWith('@phone.luka.app'));
	// Quien entró solo con Google no tiene contraseña todavía
	const hasPassword = $derived(user?.identities?.some((i) => i.provider === 'email') ?? isPhoneLogin);
	const loginLabel = $derived(isPhoneLogin ? 'Celular y contraseña' : user?.app_metadata?.provider === 'google' ? `Google · ${user.email}` : user?.email);
	const initial = $derived((name || '?').trim().charAt(0).toUpperCase());

	export async function open() {
		dialog.showModal();
		msg = { name: '', phone: '', pass: '' };
		const { data } = await supabase.auth.getUser();
		user = data.user;
		name = user?.user_metadata?.full_name || session.name || '';
		phone = (await authService.getPhoneStatus())?.phone || '';
		bioOn = biometricService.isEnabled(user.id);
		bioSupported = await biometricService.isSupported();
		notif = 'Notification' in window ? Notification.permission : 'unsupported';
	}

	onMount(open);

	async function run(key, field, fn) {
		busy = key;
		msg[field] = '';
		try {
			msg[field] = (await fn()) || 'Guardado.';
		} catch (err) {
			msg[field] = '⚠ ' + (err?.message || 'No se pudo guardar.');
		} finally {
			busy = '';
		}
	}

	const saveName = (e) =>
		run('name', 'name', async () => {
			e.preventDefault();
			const full_name = name.trim();
			if (!full_name) throw new Error('Escribe tu nombre.');
			const { error } = await supabase.auth.updateUser({ data: { full_name } });
			if (error) throw error;
			await supabase.from('profiles').update({ full_name }).eq('id', user.id);
			session.name = full_name;
		});

	const savePhone = (e) =>
		run('phone', 'phone', async () => {
			e.preventDefault();
			const value = String(new FormData(e.currentTarget).get('phone'));
			await authService.linkPhone(value, user.app_metadata?.provider || 'google');
			phone = authService.sanitizePhone(value);
			return 'Celular actualizado.';
		});

	const savePassword = (e) =>
		run('pass', 'pass', async () => {
			e.preventDefault();
			const form = e.currentTarget;
			const f = new FormData(form);
			const next = String(f.get('new'));
			if (next.length < 8) throw new Error('La contraseña debe tener al menos 8 caracteres.');
			if (next !== f.get('confirm')) throw new Error('Las contraseñas no coinciden.');
			// Cambiar exige la actual: una sesión abierta en un celular prestado no basta para quitarte la cuenta
			if (hasPassword) await authService.signIn(user.email, String(f.get('current'))).catch(() => {
				throw new Error('La contraseña actual no es correcta.');
			});
			const { data, error } = await supabase.auth.updateUser({ password: next });
			if (error) throw error;
			user = data.user;
			form.reset();
			return hasPassword ? 'Contraseña cambiada.' : 'Contraseña agregada. Ya puedes entrar con tu correo y esta contraseña.';
		});

	async function toggleBio() {
		if (bioOn) {
			biometricService.disable(user.id);
			bioOn = false;
		} else {
			try {
				await biometricService.enable(user.id, name);
				bioOn = biometricService.isEnabled(user.id);
			} catch {}
		}
	}

	async function enableNotif() {
		await notificationService.requestPushPermission();
		notif = Notification.permission;
	}
</script>

<dialog bind:this={dialog} class="modal-content profile-sheet" aria-labelledby="profile-title" closedby="any">
	<div class="modal-header">
		<h1 id="profile-title">Mi perfil</h1>
		<form method="dialog"><button class="modal-close-btn" aria-label="Cerrar">&times;</button></form>
	</div>

	<div class="profile-id">
		<span class="profile-avatar" aria-hidden="true">{initial}</span>
		<div>
			<strong>{name || 'Sin nombre'}</strong>
			<small>{loginLabel}</small>
		</div>
	</div>

	<form class="profile-block" onsubmit={saveName}>
		<div class="form-group">
			<label for="pf-name">Nombre</label>
			<input id="pf-name" bind:value={name} autocomplete="name" maxlength="80" required />
		</div>
		<button class="btn btn-secondary btn-sm" disabled={busy === 'name'}>Guardar nombre</button>
		<p class="profile-msg" aria-live="polite">{msg.name}</p>
	</form>

	<form class="profile-block" onsubmit={savePhone}>
		<div class="form-group">
			<label for="pf-phone">Celular registrado</label>
			{#if isPhoneLogin}
				<input id="pf-phone" value={phone} readonly aria-describedby="pf-phone-help" />
				<small id="pf-phone-help" class="profile-help">Es tu usuario para ingresar, por eso no se puede cambiar aquí.</small>
			{:else}
				<input id="pf-phone" name="phone" value={phone} type="tel" inputmode="numeric" autocomplete="tel-national" minlength="10" required />
			{/if}
		</div>
		{#if !isPhoneLogin}
			<button class="btn btn-secondary btn-sm" disabled={busy === 'phone'}>Actualizar celular</button>
			<p class="profile-msg" aria-live="polite">{msg.phone}</p>
		{/if}
	</form>

	<form class="profile-block" onsubmit={savePassword}>
		<h2>{hasPassword ? 'Cambiar contraseña' : 'Agregar contraseña'}</h2>
		{#if !hasPassword}
			<p class="profile-help">Entras con Google. Agrega una contraseña para poder entrar también con tu correo.</p>
		{/if}
		<input type="text" name="username" value={user?.email ?? ''} autocomplete="username" hidden />
		{#if hasPassword}
			<div class="form-group">
				<label for="pf-current">Contraseña actual</label>
				<input id="pf-current" name="current" type="password" autocomplete="current-password" required />
			</div>
		{/if}
		<div class="form-group">
			<label for="pf-new">Nueva contraseña</label>
			<input id="pf-new" name="new" type="password" autocomplete="new-password" minlength="8" required />
		</div>
		<div class="form-group">
			<label for="pf-confirm">Repite la nueva contraseña</label>
			<input id="pf-confirm" name="confirm" type="password" autocomplete="new-password" minlength="8" required />
		</div>
		<button class="btn btn-secondary btn-sm" disabled={busy === 'pass'}>{hasPassword ? 'Cambiar contraseña' : 'Agregar contraseña'}</button>
		<p class="profile-msg" aria-live="polite">{msg.pass}</p>
	</form>

	<div class="profile-block profile-rows">
		{#if bioSupported}
			<div class="profile-row">
				<span><i class="ph-duotone ph-scan-smiley" aria-hidden="true"></i> Desbloqueo con Face ID / huella</span>
				<button class="btn btn-sm {bioOn ? 'btn-secondary' : 'btn-primary'}" onclick={toggleBio} aria-pressed={bioOn}>{bioOn ? 'Desactivar' : 'Activar'}</button>
			</div>
		{/if}
		<div class="profile-row">
			<span><i class="ph-duotone ph-bell-ringing" aria-hidden="true"></i> Avisos en el celular</span>
			{#if notif === 'granted'}
				<span class="profile-ok">Activados</span>
			{:else if notif === 'denied'}
				<span class="profile-help">Bloqueados: actívalos en los ajustes del navegador</span>
			{:else if notif === 'default'}
				<button class="btn btn-sm btn-primary" onclick={enableNotif}>Activar</button>
			{:else}
				<span class="profile-help">No disponibles en este navegador</span>
			{/if}
		</div>
	</div>

	<button class="btn btn-block profile-logout" onclick={() => { dialog.close(); onlogout(); }}>
		<i class="ph-bold ph-sign-out" aria-hidden="true"></i> Cerrar sesión
	</button>
</dialog>
