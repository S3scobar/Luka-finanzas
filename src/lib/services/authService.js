// js/services/authService.js
import { PUBLIC_GOOGLE_CLIENT_ID } from "$app/env/public";
import { supabase, isMissingRpc } from "../supabaseClient.js";

// Limpia y normaliza el número a solo dígitos (elimina prefijo +57 si viene con él)
function sanitizePhone(raw) {
  let clean = String(raw || "").replace(/\D/g, "");
  if (clean.length === 12 && clean.startsWith("57")) {
    clean = clean.slice(2);
  }
  return clean;
}

export const authService = {
  sanitizePhone,

  // Convierte un número de teléfono a correo sintético para Supabase Auth
  phoneToEmail(phone) {
    const clean = sanitizePhone(phone);
    if (clean.length < 10) {
      throw new Error("El número de celular debe tener al menos 10 dígitos.");
    }
    return `${clean}@phone.luka.app`;
  },

  // Botón oficial de Google (Google Identity Services): Google habla con el dominio de LUKA y
  // no con el de Supabase, así que su pantalla muestra LUKA. Devuelve false si no hay ID de cliente.
  async mountGoogleButton(host, onError) {
    if (!PUBLIC_GOOGLE_CLIENT_ID) return false;
    await loadGsi();
    // El nonce cifrado va a Google y el original a Supabase, que comprueba que coincidan
    const raw = crypto.randomUUID() + crypto.randomUUID();
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
    const hashed = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
    google.accounts.id.initialize({
      client_id: PUBLIC_GOOGLE_CLIENT_ID,
      nonce: hashed,
      context: "signin",
      ux_mode: "popup",
      itp_support: true,
      use_fedcm_for_button: true,
      callback: async ({ credential }) => {
        const { error } = await supabase.auth.signInWithIdToken({ provider: "google", token: credential, nonce: raw });
        if (error) onError?.(error);
      }
    });
    google.accounts.id.renderButton(host, {
      theme: document.documentElement.dataset.theme === "dark" ? "filled_black" : "outline",
      size: "large",
      shape: "pill",
      text: "continue_with",
      logo_alignment: "center",
      locale: "es",
      width: Math.min(400, host.clientWidth || 320)
    });
    return true;
  },

  // Respaldo: OAuth a través de Supabase (Google muestra el dominio de Supabase)
  async signInWithGoogle() {
    const redirectTo = window.location.origin + window.location.pathname;
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo
      }
    });
    if (error) throw error;
    return data;
  },

  // Registro con correo o teléfono sintético
  async signUp(email, password, fullName) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName }
      }
    });
    if (error) throw error;
    return data;
  },

  // Registro con número de celular
  async signUpWithPhone(phone, password, fullName) {
    const cleanPhone = sanitizePhone(phone);
    if (cleanPhone.length < 10) {
      throw new Error("El número de celular debe tener al menos 10 dígitos.");
    }

    // Verificar tope de 2 cuentas antes de registrar
    const avail = await this.checkPhoneAvailability(cleanPhone);
    if (!avail.available) {
      throw new Error("Este número de celular ya alcanzó el límite máximo permitido (2 cuentas).");
    }

    const email = `${cleanPhone}@phone.luka.app`;
    const res = await this.signUp(email, password, fullName);

    if (res?.session?.user) {
      try {
        await this.linkPhone(cleanPhone, "phone");
      } catch (e) {
        console.warn("No se pudo auto-vincular teléfono:", e);
      }
    }
    return res;
  },

  // Login tradicional
  async signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    if (error) throw error;
    return data;
  },

  // Login con celular (o correo para cuentas existentes)
  async signInWithPhone(phoneOrEmail, password) {
    let identifier = String(phoneOrEmail || "").trim();
    if (!identifier.includes("@")) {
      identifier = this.phoneToEmail(identifier);
    }
    return this.signIn(identifier, password);
  },

  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  async getCurrentUser() {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) return null;
    return user;
  },

  onAuthStateChanged(callback) {
    return supabase.auth.onAuthStateChange((event, session) => {
      callback(session?.user || null, event);
    });
  },

  // Consulta si el usuario actual tiene teléfono vinculado en user_phones
  async getPhoneStatus() {
    try {
      const { data, error } = await supabase.rpc("get_my_phone_status");
      if (error) {
        // Si el SQL aún no se ha ejecutado en Supabase, no bloquea al usuario
        console.warn("RPC get_my_phone_status no disponible:", error.message);
        return { has_phone: true, unconfigured: true };
      }
      return data || { has_phone: false, phone: null };
    } catch {
      return { has_phone: true, unconfigured: true };
    }
  },

  // Consulta disponibilidad (< 2 cuentas)
  async checkPhoneAvailability(phone) {
    try {
      const cleanPhone = sanitizePhone(phone);
      const { data, error } = await supabase.rpc("check_phone_availability", {
        p_phone: cleanPhone
      });
      if (error) return { available: true };
      return data || { available: true };
    } catch {
      return { available: true };
    }
  },

  // Vincula el teléfono al usuario actual respetando el límite de 2 cuentas
  async linkPhone(phone, provider = "google") {
    const cleanPhone = sanitizePhone(phone);
    if (cleanPhone.length < 10) {
      throw new Error("El número de celular debe tener al menos 10 dígitos.");
    }
    const { data, error } = await supabase.rpc("link_phone_number", {
      p_phone: cleanPhone,
      p_provider: provider
    });
    if (error) throw error;
    if (!data.success) {
      throw new Error(data.error || "No se pudo vincular el celular.");
    }
    return data;
  },

  // Borrar registro: elimina todos los datos financieros y deja la cuenta como nueva (una sola transacción en la base)
  async resetMyData() {
    const { error } = await supabase.rpc("reset_my_data");
    if (isMissingRpc(error)) throw new Error("Falta activar esta función en la base de datos (supabase/migrations/20261123_reset_my_data.sql).");
    if (error) throw error;
  },

  // Registra actividad del usuario para mantener la cuenta viva (evita purga por inactividad de 2 meses)
  async recordActivity() {
    try {
      await supabase.rpc("record_user_activity");
    } catch {
      // Silencioso: no interrumpe el flujo si la función aún no se ha creado
    }
  }
};
let gsi;
function loadGsi() {
  gsi ??= new Promise((resolve, reject) => {
    const el = document.createElement("script");
    el.src = "https://accounts.google.com/gsi/client";
    el.async = true;
    el.onload = resolve;
    el.onerror = () => { gsi = null; reject(new Error("No se pudo cargar el inicio de sesión de Google")); };
    document.head.append(el);
  });
  return gsi;
}
