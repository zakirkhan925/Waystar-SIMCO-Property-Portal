create type public.lease_status as enum ('draft', 'active', 'expired', 'terminated', 'renewed');
create type public.lease_event_type as enum
  ('created', 'rent_increased', 'penalty_added', 'penalty_waived', 'expired', 'terminated', 'renewed');
create type public.deposit_txn_type as enum ('received', 'adjusted', 'refunded');

create table public.leases (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units(id),
  project_id uuid not null references public.projects(id),
  agreement_no text not null unique,
  landlord_client_id uuid references public.clients(id),
  tenant_client_id uuid not null references public.clients(id),
  start_date date not null,
  end_date date not null check (end_date >= start_date),
  monthly_rent numeric(14,2) not null check (monthly_rent >= 1),
  current_rent numeric(14,2) not null,
  security_deposit numeric(14,2) not null default 0 check (security_deposit >= 0),
  increment_pct numeric(5,2) not null check (increment_pct between 0 and 100),
  rent_due_day smallint not null default 1 check (rent_due_day between 1 and 28),
  commission_pct numeric(5,2) not null check (commission_pct between 0 and 100),
  agent_id uuid references public.profiles(id),
  dealer_id uuid references public.dealers(id),
  status public.lease_status not null default 'active',
  renewed_from_id uuid unique references public.leases(id),
  terminated_on date,
  termination_reason text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles(id)
);
create unique index leases_one_active_per_unit on public.leases (unit_id) where status = 'active';
create index leases_project_idx on public.leases (project_id, status);
create index leases_tenant_idx on public.leases (tenant_client_id);
create index leases_landlord_idx on public.leases (landlord_client_id);
create trigger leases_touch before update on public.leases
  for each row execute function private.touch_updated_at();

create table public.rent_invoices (
  id uuid primary key default gen_random_uuid(),
  lease_id uuid not null references public.leases(id),
  invoice_no text not null unique,
  period date not null,
  due_date date not null,
  rent_amount numeric(14,2) not null check (rent_amount > 0),
  late_fee numeric(14,2) not null default 0 check (late_fee >= 0),
  waived_amount numeric(14,2) not null default 0 check (waived_amount between 0 and late_fee),
  amount_due numeric(14,2) generated always as (rent_amount + late_fee - waived_amount) stored,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles(id),
  unique (lease_id, period)
);

create table public.rent_payments (
  id uuid primary key default gen_random_uuid(),
  lease_id uuid not null references public.leases(id),
  receipt_no text not null unique,
  received_on date not null,
  amount numeric(14,2) not null check (amount > 0),
  mode public.payment_mode not null,
  bank_name text,
  instrument_no text,
  instrument_date date,
  instrument_status public.instrument_status not null,
  cleared_on date,
  bounced_reason text,
  status public.record_status not null default 'valid',
  reversed_at timestamptz,
  reversed_by uuid references public.profiles(id),
  reversal_reason text,
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles(id)
);
create index rent_payments_lease_idx on public.rent_payments (lease_id);

create table public.rent_payment_allocations (
  id uuid primary key default gen_random_uuid(),
  rent_payment_id uuid not null references public.rent_payments(id),
  rent_invoice_id uuid not null references public.rent_invoices(id),
  component text not null check (component in ('rent', 'late_fee')),
  amount numeric(14,2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles(id),
  unique (rent_payment_id, rent_invoice_id, component)
);
create index rent_allocations_invoice_idx on public.rent_payment_allocations (rent_invoice_id);

create table public.deposit_transactions (
  id uuid primary key default gen_random_uuid(),
  lease_id uuid not null references public.leases(id),
  type public.deposit_txn_type not null,
  txn_date date not null,
  amount numeric(14,2) not null check (amount <> 0 and (type = 'adjusted' or amount > 0)),
  reason text not null,
  reference_no text,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles(id)
);
create index deposit_transactions_lease_idx on public.deposit_transactions (lease_id);

create table public.lease_events (
  id uuid primary key default gen_random_uuid(),
  lease_id uuid not null references public.leases(id),
  type public.lease_event_type not null,
  event_date date not null,
  rent_invoice_id uuid references public.rent_invoices(id),
  lease_year int,
  old_rent numeric(14,2),
  new_rent numeric(14,2),
  amount numeric(14,2),
  details text,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles(id),
  unique (lease_id, lease_year)
);
create index lease_events_lease_idx on public.lease_events (lease_id, event_date);

create table public.owner_payouts (
  id uuid primary key default gen_random_uuid(),
  lease_id uuid not null references public.leases(id),
  paid_on date not null,
  amount numeric(14,2) not null check (amount > 0),
  mode public.payment_mode not null,
  reference_no text not null,
  status public.record_status not null default 'valid',
  reversed_at timestamptz,
  reversed_by uuid references public.profiles(id),
  reversal_reason text,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles(id)
);
create index owner_payouts_lease_idx on public.owner_payouts (lease_id);

alter table public.commissions add foreign key (lease_id) references public.leases(id);
create unique index commissions_lease_uq on public.commissions (lease_id) where lease_id is not null;

create function private.can_see_lease(p_lease uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.leases l where l.id = p_lease
      and private.can_access_project(l.project_id)
      and (private.has_role('super_admin','manager','accounts','viewer')
        or (private.has_role('sales_agent') and l.agent_id = auth.uid()))
  )
$$;
revoke execute on function private.can_see_lease(uuid) from public, anon;
grant execute on function private.can_see_lease(uuid) to authenticated;

do $$
declare t text;
begin
  foreach t in array array['leases', 'rent_invoices', 'rent_payments', 'rent_payment_allocations',
                           'deposit_transactions', 'lease_events', 'owner_payouts']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
    execute format('create trigger %I after insert or update or delete on public.%I
                    for each row execute function private.audit_row()', t || '_audit', t);
  end loop;

  foreach t in array array['rent_invoices', 'rent_payments', 'deposit_transactions', 'lease_events', 'owner_payouts']
  loop
    execute format('create policy %I on public.%I for select to authenticated
                    using ((select private.can_see_lease(lease_id)))', t || '_select', t);
  end loop;
end $$;

create policy leases_select on public.leases for select to authenticated
  using ((select private.can_see_lease(id)));
create policy rent_allocations_select on public.rent_payment_allocations for select to authenticated
  using (exists (select 1 from public.rent_payments p where p.id = rent_payment_id));

alter policy commissions_select on public.commissions
  using (case when lease_id is not null then (select private.can_see_lease(lease_id))
    else (select private.can_access_project(project_id))
      and ((select private.has_role('super_admin','manager','accounts','viewer')) or agent_id = (select auth.uid()))
  end);
