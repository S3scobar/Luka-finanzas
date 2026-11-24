// Puente hacia Supabase: el navegador solo conoce /sb en el dominio de LUKA.
// Añade aquí la clave real; solo deja pasar Auth y la API REST (no es un proxy abierto).
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '$app/env/private';
const PLACEHOLDER_KEY = 'luka'; // la misma clave de relleno que usa lib/supabaseClient.js

export const prerender = false;

const ALLOWED = /^(auth|rest)\/v1\//;
const REQUEST_HEADERS = ['accept', 'accept-profile', 'content-profile', 'content-type', 'prefer', 'range', 'x-client-info', 'x-supabase-api-version', 'authorization'];
const RESPONSE_HEADERS = ['content-type', 'content-range', 'location', 'preference-applied', 'x-supabase-api-version'];

async function proxy({ request, params, url }) {
	if (!ALLOWED.test(params.path)) return new Response('Not found', { status: 404 });

	const headers = new Headers();
	for (const h of REQUEST_HEADERS) {
		const v = request.headers.get(h);
		if (v) headers.set(h, v);
	}
	headers.set('apikey', SUPABASE_ANON_KEY);
	// Sin sesión, supabase-js manda la clave de relleno como token: se cambia por la real
	if (!headers.get('authorization') || headers.get('authorization') === `Bearer ${PLACEHOLDER_KEY}`) {
		headers.set('authorization', `Bearer ${SUPABASE_ANON_KEY}`);
	}

	const res = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/${params.path}${url.search}`, {
		method: request.method,
		headers,
		body: request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.arrayBuffer(),
		redirect: 'manual'
	});

	const out = new Headers({ 'cache-control': 'no-store' });
	for (const h of RESPONSE_HEADERS) {
		const v = res.headers.get(h);
		if (v) out.set(h, v);
	}
	return new Response(res.body, { status: res.status, statusText: res.statusText, headers: out });
}

export const GET = proxy;
export const HEAD = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
