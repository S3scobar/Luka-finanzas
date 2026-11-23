// Service worker de LUKA (antes sw.js). SvelteKit lo compila y lo registra solo.
// - Código y estilos con hash en el nombre (inmutables): caché primero, nunca se mezclan versiones.
// - Páginas: red primero; sin conexión, la copia prerenderizada.
// - Supabase y las tasas de cambio nunca pasan por caché: los datos siempre son frescos.
import { self } from '$app/service-worker';
import { immutable, assets, prerendered } from '$app/manifest';
import { version } from '$app/env';

const CACHE = `luka-${version}`;
const PRECACHE = [...immutable, ...assets, ...prerendered].map((f) => f.path);
const IMMUTABLE = new Set(immutable.map((f) => f.path));

self.addEventListener('install', (event) => {
	event.waitUntil(
		caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
	);
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches.keys()
			.then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
			.then(() => self.clients.claim())
	);
});

self.addEventListener('fetch', (event) => {
	const req = event.request;
	if (req.method !== 'GET') return;
	const url = new URL(req.url);
	if (url.origin !== self.location.origin) return;

	if (IMMUTABLE.has(url.pathname)) {
		event.respondWith(caches.match(url.pathname).then((hit) => hit || fetch(req)));
		return;
	}

	event.respondWith(
		fetch(req)
			.then((res) => {
				if (res.ok && res.type === 'basic') {
					const copy = res.clone();
					caches.open(CACHE).then((c) => c.put(req, copy));
				}
				return res;
			})
			.catch(async () => {
				const hit = (await caches.match(req)) || (await caches.match(url.pathname));
				// Una pestaña de la app sin conexión abre el inicio (el marco es el mismo)
				return hit || (req.mode === 'navigate' && (await caches.match('/'))) || Response.error();
			})
	);
});

// Tocar una notificación abre LUKA (o la trae al frente) en la pestaña del aviso
self.addEventListener('notificationclick', (event) => {
	event.notification.close();
	const url = new URL(event.notification.data?.url || '/', self.location.origin).href;
	event.waitUntil(
		self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
			const win = wins.find((w) => new URL(w.url).origin === self.location.origin);
			return win ? win.focus().then((w) => w.navigate(url)) : self.clients.openWindow(url);
		})
	);
});
