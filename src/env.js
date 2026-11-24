import { defineEnvVars } from '@sveltejs/kit/env';

// La dirección y la clave de Supabase solo viven en el servidor (Vercel): el navegador habla con
// /sb en el propio dominio de LUKA y src/routes/sb reenvía a Supabase.
// Mientras se renombran en Vercel se aceptan los nombres viejos PUBLIC_*.
const fromEnv = (name, legacy) => (value) => {
	const v = value || process.env[legacy];
	if (!v) throw new Error(`Falta la variable ${name} en el servidor`);
	return v;
};

export const variables = defineEnvVars({
	SUPABASE_URL: { schema: fromEnv('SUPABASE_URL', 'PUBLIC_SUPABASE_URL'), description: 'URL del proyecto de Supabase (solo servidor)' },
	SUPABASE_ANON_KEY: { schema: fromEnv('SUPABASE_ANON_KEY', 'PUBLIC_SUPABASE_ANON_KEY'), description: 'Clave anon/publishable de Supabase (solo servidor)' },
	PUBLIC_GOOGLE_CLIENT_ID: {
		public: true,
		static: true,
		schema: (v) => v || '',
		description: 'ID de cliente web de Google (público por diseño). Vacío: se usa el flujo OAuth de Supabase'
	}
});
