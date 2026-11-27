-- Categorías por defecto para pagos de préstamos y tarjetas (el usuario puede elegir otra en cada pago).
-- Las cuentas nuevas y "Borrar registro" las reciben desde seed_user_defaults; las existentes, aquí.

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
    (p_user_id, 'Préstamos', 'expense', 'fa-hand-holding-dollar', '#8B5CF6', false, 0),
    (p_user_id, 'Tarjetas', 'expense', 'fa-credit-card', '#6366F1', false, 0),
    (p_user_id, 'Salario', 'income', 'fa-briefcase', '#10B981', false, 0),
    (p_user_id, 'Inversiones', 'income', 'fa-chart-line', '#3B82F6', false, 0),
    (p_user_id, 'Otros Ingresos', 'income', 'fa-wallet', '#6366F1', false, 0);
end; $$;

insert into public.categories (user_id, name, type, icon, color)
select p.id, c.name, 'expense', c.icon, c.color
from public.profiles p
cross join (values
  ('Préstamos', 'fa-hand-holding-dollar', '#8B5CF6'),
  ('Tarjetas',  'fa-credit-card',         '#6366F1')
) as c(name, icon, color)
where not exists (
  select 1 from public.categories x where x.user_id = p.id and x.type = 'expense' and lower(x.name) = lower(c.name)
);

revoke execute on function public.seed_user_defaults(uuid) from public, anon, authenticated;
