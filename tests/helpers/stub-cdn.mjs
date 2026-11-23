// Sustituye supabase-js y los módulos virtuales de SvelteKit para probar la lógica pura en Node, sin red.
const STUBS = {
  "@supabase/supabase-js": "export const createClient = () => ({});",
  "$app/env/public": "export const PUBLIC_SUPABASE_URL = ''; export const PUBLIC_SUPABASE_ANON_KEY = '';"
};
export async function resolve(specifier, context, next) {
  if (specifier in STUBS) return { url: `stub:${specifier}`, shortCircuit: true };
  return next(specifier, context);
}
export async function load(url, context, next) {
  if (url.startsWith("stub:")) {
    return { format: "module", source: STUBS[url.slice(5)], shortCircuit: true };
  }
  return next(url, context);
}
