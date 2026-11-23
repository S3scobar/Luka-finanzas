import { defineEnvVars } from '@sveltejs/kit/env';

// Valores públicos por diseño (la anon key solo funciona bajo las políticas RLS de la base).
export const variables = defineEnvVars({
	PUBLIC_SUPABASE_URL: { public: true, static: true, description: 'URL del proyecto de Supabase' },
	PUBLIC_SUPABASE_ANON_KEY: { public: true, static: true, description: 'Clave anon/publishable de Supabase' }
});
