-- Moneda por billetera (COP, USD, EUR). profiles.currency ya existe y guarda la moneda base de la cuenta.
alter table public.wallets
  add column if not exists currency text not null default 'COP'
  check (currency in ('COP', 'USD', 'EUR'));

update public.profiles set currency = 'COP' where currency is null or currency not in ('COP', 'USD', 'EUR');
alter table public.profiles alter column currency set not null;
alter table public.profiles drop constraint if exists profiles_currency_check;
alter table public.profiles add constraint profiles_currency_check check (currency in ('COP', 'USD', 'EUR'));
