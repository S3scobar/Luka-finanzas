import adapter from '@sveltejs/adapter-vercel';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		sveltekit({
			compilerOptions: {
				runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true)
			},
			adapter: adapter(),
			// Las páginas se prerenderizan, así que la CSP va con hashes en una <meta>.
			// frame-ancestors no funciona en <meta>: va como cabecera en vercel.json.
			csp: {
				mode: 'hash',
				directives: {
					'default-src': ['self'],
					'script-src': ['self', 'https://accounts.google.com/gsi/client'],
					// Las vistas heredadas usan atributos style="…"
					'style-src': ['self', 'unsafe-inline', 'https://accounts.google.com/gsi/style'],
					'img-src': ['self', 'data:', 'blob:', 'https://*.googleusercontent.com'],
					'font-src': ['self', 'data:'],
					'connect-src': ['self', 'https://open.er-api.com', 'https://accounts.google.com/gsi/'],
					// Botón oficial de Google (iniciar sesión en el dominio de LUKA)
					'frame-src': ['https://accounts.google.com/gsi/'],
					'manifest-src': ['self'],
					'worker-src': ['self'],
					'object-src': ['none'],
					'base-uri': ['none'],
					'form-action': ['self'],
					'upgrade-insecure-requests': true
				}
			}
		})
	]
});
