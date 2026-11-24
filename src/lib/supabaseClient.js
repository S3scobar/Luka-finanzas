import { createClient } from "@supabase/supabase-js";

// El navegador habla con /sb en el propio dominio; el servidor (routes/sb) pone la dirección y la
// clave reales de Supabase. Por eso aquí solo hay una clave de relleno.
export const PLACEHOLDER_KEY = "luka";
const STORAGE_KEY = "luka-auth";

const origin = typeof location === "undefined" ? "http://localhost" : location.origin;

// Sesiones guardadas con el nombre anterior (sb-<proyecto>-auth-token): se mueven para no cerrar sesión
if (typeof localStorage !== "undefined" && !localStorage.getItem(STORAGE_KEY)) {
  try {
    const old = Object.keys(localStorage).find((k) => /^sb-.+-auth-token$/.test(k));
    if (old) {
      localStorage.setItem(STORAGE_KEY, localStorage.getItem(old));
      localStorage.removeItem(old);
    }
  } catch {}
}

export const supabase = createClient(`${origin}/sb`, PLACEHOLDER_KEY, { auth: { storageKey: STORAGE_KEY } });

// Devuelve el id del usuario autenticado leyendo la sesión local.
// A diferencia de supabase.auth.getUser(), no hace una petición de red en cada llamada;
// la autorización real la imponen las políticas RLS de la base de datos.
export async function requireUserId() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error("Usuario no autenticado");
  return session.user.id;
}

// PostgREST responde con estos códigos cuando una función RPC no está desplegada
export function isMissingRpc(error) {
  return error?.code === "PGRST202" || error?.code === "42883";
}
