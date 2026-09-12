-- CONVERGE authoritative pricing source
-- One row per product. Service-role server access only; public clients never write pricing.
create table if not exists public.converge_pricing (
  product_key text primary key check (product_key in ('mbti', 'comprehensive', 'recruiter')),
  name text not null,
  price_cents integer not null check (price_cents >= 0),
  currency text not null default 'ZAR',
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into public.converge_pricing (product_key, name, price_cents, currency, active)
values
  ('mbti', 'Converge 1: MBTI Basic', 3000, 'ZAR', true),
  ('comprehensive', 'Converge 2: Comprehensive', 5000, 'ZAR', true),
  ('recruiter', 'Converge 3: Recruiter All-in', 10000, 'ZAR', true)
on conflict (product_key) do nothing;

alter table public.converge_pricing enable row level security;

-- No anon/authenticated policies are intentionally created.
-- The server uses SUPABASE_SERVICE_ROLE_KEY for authoritative reads/writes.

create index if not exists converge_pricing_active_idx
  on public.converge_pricing (active);
