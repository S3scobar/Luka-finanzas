// js/services/subscriptionService.js
import { supabase, requireUserId } from "../supabaseClient.js";

export const subscriptionService = {
  // Obtener todas las suscripciones ordenadas por el día de cobro
  async getSubscriptions() {
    const { data, error } = await supabase
      .from("subscriptions")
      .select(`
        *,
        wallet:wallets(name, color, icon),
        category:categories(name, color, icon)
      `)
      .order("billing_day", { ascending: true });

    if (error) throw error;
    return data || [];
  },

  // Crear suscripción
  async createSubscription({ name, amount, billing_day, wallet_id = null, category_id = null }) {
    const userId = await requireUserId();

    const { data, error } = await supabase
      .from("subscriptions")
      .insert([
        {
          user_id: userId,
          name: name.trim(),
          amount: parseFloat(amount),
          billing_day: parseInt(billing_day),
          wallet_id: wallet_id || null,
          category_id: category_id || null,
          is_active: true
        }
      ])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Editar datos o pausar/reanudar ({ is_active })
  async updateSubscription(id, fields) {
    const { data, error } = await supabase
      .from("subscriptions")
      .update(fields)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Eliminar suscripción
  async deleteSubscription(id) {
    const { error } = await supabase
      .from("subscriptions")
      .delete()
      .eq("id", id);

    if (error) throw error;
    return true;
  }
};