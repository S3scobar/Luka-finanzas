-- Borrar registro: el usuario vuelve a empezar de cero sin perder su cuenta.
-- Se conservan perfil (nombre, moneda base), celular vinculado y actividad; todo lo financiero se borra
-- en una sola transacción y se recrean la billetera y las categorías iniciales, como en una cuenta nueva.

-- Datos iniciales en un solo lugar: los usan el alta de usuario y el reinicio
create or replace function public.seed_user_defaults(p_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.wallets (user_id, name, balance, color, icon)
  values (p_user_id, 'Efectivo Principal', 0.00, '#10B981', 'fa-money-bill-wave');

  insert into public.categories (user_id, name, type, icon, color, is_favorite, favorite_order) values
    (p_user_id, 'Alimentación', 'expense', 'fa-utensils', '#F59E0B', true, 1),
    (p_user_id, 'Transporte', 'expense', 'fa-bus', '#3B82F6', true, 2),
    (p_user_id, 'Vivienda', 'expense', 'fa-house', '#8B5CF6', true, 3),
    (p_user_id, 'Ocio', 'expense', 'fa-gamepad', '#EC4899', true, 4),
    (p_user_id, 'Servicios', 'expense', 'fa-bolt', '#06B6D4', false, 0),
    (p_user_id, 'Salud', 'expense', 'fa-heart-pulse', '#EF4444', false, 0),
    (p_user_id, 'Educación', 'expense', 'fa-graduation-cap', '#10B981', false, 0),
    (p_user_id, 'Ahorro', 'expense', 'fa-piggy-bank', '#14B8A6', false, 0),
    (p_user_id, 'Gasto hormiga', 'expense', 'fa-cookie-bite', '#F97316', false, 0),
    (p_user_id, 'Salario', 'income', 'fa-briefcase', '#10B981', false, 0),
    (p_user_id, 'Inversiones', 'income', 'fa-chart-line', '#3B82F6', false, 0),
    (p_user_id, 'Otros Ingresos', 'income', 'fa-wallet', '#6366F1', false, 0);
end; $$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', 'Usuario'));
  perform public.seed_user_defaults(new.id);
  return new;
end; $$;

create or replace function public.reset_my_data()
returns void language plpgsql security definer set search_path = public as $$
declare v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'Sesión no iniciada'; end if;
  -- Orden por llaves foráneas (transactions.category_id es "on delete restrict")
  delete from public.loan_payments         where user_id = v_user_id;
  delete from public.loans                 where user_id = v_user_id;
  delete from public.credit_card_purchases where user_id = v_user_id;
  delete from public.credit_cards          where user_id = v_user_id;
  delete from public.subscriptions         where user_id = v_user_id;
  delete from public.budgets               where user_id = v_user_id;
  delete from public.saving_goals          where user_id = v_user_id;
  delete from public.transactions          where user_id = v_user_id;
  delete from public.wallets               where user_id = v_user_id;
  delete from public.categories            where user_id = v_user_id;
  perform public.seed_user_defaults(v_user_id);
end; $$;

revoke execute on function public.seed_user_defaults(uuid) from public, anon, authenticated;
revoke execute on function public.reset_my_data()          from public, anon;
grant  execute on function public.reset_my_data()          to authenticated;
