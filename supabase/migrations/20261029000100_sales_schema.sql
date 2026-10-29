-- Phase 2 (schema): payment plans, sales, joint buyers, ownership history, installments,
-- document numbering, payments + allocations, commissions.
--
-- Money rules (docs/02-business-rules.md):
--   * every amount is numeric(14,2); nothing is computed in floating point
--   * a payment counts as CLEARED only when it is valid and its instrument has cleared
--     (cash/online clear instantly; cheques / pay orders / transfers must be marked cleared)
--   * installment paid/pending totals are derived from allocations, never typed in
--   * payments are never deleted — only reversed, with a reason

create type public.sale_status        as enum ('booked','active','completed','cancelled','transferred');
create type public.plan_kind          as enum ('full_cash','installment');
create type public.plan_frequency     as enum ('monthly','quarterly','bi_annual','annual');
create type public.installment_type   as enum ('down_payment','installment','possession','balloon','other');
create type public.installment_status as enum ('pending','partially_paid','paid','overdue','waived');
create type public.payment_mode       as enum ('cash','cheque','pay_order','bank_transfer','online');
create type public.instrument_status  as enum ('not_applicable','pending','cleared','bounced');
create type public.record_status      as enum ('valid','reversed');
create type public.ownership_via      as enum ('booking','transfer','correction');
create type public.commission_status  as enum ('pending','partially_received','received','cancelled');

-- months between two installments of a given frequency
create or replace function private.frequency_months(f public.plan_frequency) returns int
language sql immutable set search_path = '' as $$
  select case f when 'monthly' then 1 when 'quarterly' then 3 when 'bi_annual' then 6 else 12 end
$$;

-- ---------------------------------------------------------------------------
-- Payment plan templates
-- ---------------------------------------------------------------------------
create table public.payment_plans (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid references public.projects(id),   -- null = usable by every project
  name              text not null,
  kind              public.plan_kind not null,
  down_payment_pct  numeric(5,2) not null default 40 check (down_payment_pct between 0 and 100),
  installment_pct   numeric(5,2) not null default 50 check (installment_pct between 0 and 100),
  possession_pct    numeric(5,2) not null default 10 check (possession_pct between 0 and 100),
  tenure_months     smallint check (tenure_months between 1 and 240),
  frequency         public.plan_frequency,
  is_default        boolean not null default false,
  is_active         boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles(id), deleted_at timestamptz,
  constraint plan_pct_total check (down_payment_pct + installment_pct + possession_pct = 100),
  constraint plan_installment_fields check (
    kind = 'full_cash' or (tenure_months is not null and frequency is not null and installment_pct > 0)),
  constraint plan_cash_fields check (kind = 'installment' or (down_payment_pct = 100))
);
create index payment_plans_project_idx on public.payment_plans (project_id) where deleted_at is null;
create unique index payment_plans_one_default on public.payment_plans
  (coalesce(project_id, '00000000-0000-0000-0000-000000000000'::uuid)) where is_default and deleted_at is null;
create trigger payment_plans_touch before update on public.payment_plans
  for each row execute function private.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Sales (a booking and everything that follows from it)
-- ---------------------------------------------------------------------------
create table public.sales (
  id                 uuid primary key default gen_random_uuid(),
  unit_id            uuid not null references public.units(id),
  project_id         uuid not null references public.projects(id),   -- denormalized for RLS and reports
  booking_form_no    text not null,
  booking_date       date not null,
  list_price         numeric(14,2) not null check (list_price >= 0),
  discount           numeric(14,2) not null default 0 check (discount >= 0),
  final_price        numeric(14,2) generated always as (list_price - discount) stored,
  plan_kind          public.plan_kind not null,
  payment_plan_id    uuid references public.payment_plans(id),
  -- plan terms copied at booking: the template may change later, this sale must not
  down_payment_pct   numeric(5,2) check (down_payment_pct between 0 and 100),
  installment_pct    numeric(5,2) check (installment_pct between 0 and 100),
  possession_pct     numeric(5,2) check (possession_pct between 0 and 100),
  tenure_months      smallint,
  frequency          public.plan_frequency,
  booking_amount     numeric(14,2) check (booking_amount >= 0),  -- part of the down payment
  first_installment_date date,
  is_custom_schedule boolean not null default false,
  agent_id           uuid references public.profiles(id),
  dealer_id          uuid references public.dealers(id),
  commission_pct     numeric(5,2) not null default 5.00 check (commission_pct between 0 and 100),
  status             public.sale_status not null default 'booked',
  cancellation_due   boolean not null default false,  -- N consecutive missed installments; a Manager decides
  notes              text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles(id), deleted_at timestamptz,
  constraint sales_discount_le_price check (discount <= list_price),
  constraint sales_booking_le_price check (booking_amount is null or booking_amount <= list_price - discount)
);
-- one live sale per unit: the database refuses a double booking
create unique index sales_one_live_per_unit on public.sales (unit_id)
  where status in ('booked','active') and deleted_at is null;
create unique index sales_booking_no_uq on public.sales (project_id, upper(booking_form_no)) where deleted_at is null;
create index sales_project_status_idx on public.sales (project_id, status) where deleted_at is null;
create index sales_unit_idx on public.sales (unit_id);
create index sales_agent_idx on public.sales (agent_id);
create index sales_booking_date_idx on public.sales (booking_date);
create trigger sales_touch before update on public.sales
  for each row execute function private.touch_updated_at();

-- Joint ownership: who bought, and in what share
create table public.sale_buyers (
  sale_id    uuid not null references public.sales(id) on delete cascade,
  client_id  uuid not null references public.clients(id),
  share_pct  numeric(5,2) not null check (share_pct > 0 and share_pct <= 100),
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (sale_id, client_id)
);
create index sale_buyers_client_idx on public.sale_buyers (client_id);
create unique index sale_buyers_one_primary on public.sale_buyers (sale_id) where is_primary;

-- Shares must total 100% and exactly one buyer must be primary. Deferred so a sale can be
-- assembled row by row inside one transaction.
create or replace function private.check_sale_buyers() returns trigger
language plpgsql set search_path = '' as $$
declare
  v_sale uuid := coalesce(new.sale_id, old.sale_id);
  v_total numeric; v_primary int; v_count int;
begin
  -- the sale itself may have been deleted in this transaction
  if not exists (select 1 from public.sales where id = v_sale) then
    return null;
  end if;
  select coalesce(sum(share_pct), 0), count(*) filter (where is_primary), count(*)
    into v_total, v_primary, v_count
  from public.sale_buyers where sale_id = v_sale;
  if v_count = 0 then
    raise exception 'A sale needs at least one buyer';
  end if;
  if v_total <> 100 then
    raise exception 'Buyer shares must add up to 100%% (currently %%%)', v_total;
  end if;
  if v_primary <> 1 then
    raise exception 'Exactly one buyer must be marked as the primary buyer';
  end if;
  return null;
end $$;

create constraint trigger sale_buyers_check after insert or update or delete on public.sale_buyers
  deferrable initially deferred for each row execute function private.check_sale_buyers();

-- ---------------------------------------------------------------------------
-- Ownership history: time-sliced, so a unit's owners are reconstructable for any date
-- ---------------------------------------------------------------------------
create table public.unit_ownerships (
  id           uuid primary key default gen_random_uuid(),
  unit_id      uuid not null references public.units(id),
  sale_id      uuid not null references public.sales(id),
  client_id    uuid not null references public.clients(id),
  share_pct    numeric(5,2) not null check (share_pct > 0 and share_pct <= 100),
  valid_from   date not null,
  valid_to     date,                                   -- null = current owner
  acquired_via public.ownership_via not null,
  transfer_id  uuid,                                   -- set in Phase 3
  created_at   timestamptz not null default now(),
  created_by   uuid default auth.uid() references public.profiles(id),
  constraint ownership_dates check (valid_to is null or valid_to >= valid_from)
);
create index unit_ownerships_unit_idx on public.unit_ownerships (unit_id, valid_to);
create index unit_ownerships_client_idx on public.unit_ownerships (client_id);
create index unit_ownerships_sale_idx on public.unit_ownerships (sale_id);

-- ---------------------------------------------------------------------------
-- Installment schedule
-- ---------------------------------------------------------------------------
create table public.installments (
  id             uuid primary key default gen_random_uuid(),
  sale_id        uuid not null references public.sales(id),
  seq            smallint not null,
  type           public.installment_type not null,
  label          text not null,
  due_date       date,                                   -- null = due on notice (e.g. possession)
  amount_due     numeric(14,2) not null check (amount_due >= 0),
  amount_paid    numeric(14,2) not null default 0 check (amount_paid >= 0),      -- from cleared allocations
  amount_pending numeric(14,2) not null default 0 check (amount_pending >= 0),   -- cheques not yet cleared
  late_fee       numeric(14,2) not null default 0 check (late_fee >= 0),
  waived_amount  numeric(14,2) not null default 0 check (waived_amount >= 0),
  status         public.installment_status not null default 'pending',
  days_overdue   int not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles(id), deleted_at timestamptz,
  unique (sale_id, seq)
);
create index installments_due_idx on public.installments (due_date)
  where status in ('pending','partially_paid','overdue') and deleted_at is null;
create index installments_sale_idx on public.installments (sale_id, seq);
create trigger installments_touch before update on public.installments
  for each row execute function private.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Gap-free document numbering, per project / type / year
-- ---------------------------------------------------------------------------
create table public.doc_sequences (
  project_id uuid not null references public.projects(id),
  doc_type   text not null,          -- RCPT, BF, AL, SA, PL, NDC, TRF, REF …
  year       smallint not null,
  last_no    int not null default 0,
  primary key (project_id, doc_type, year)
);

-- ---------------------------------------------------------------------------
-- Payments (receipts) and their allocation to installments
-- ---------------------------------------------------------------------------
create table public.payments (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid not null references public.projects(id),
  sale_id           uuid not null references public.sales(id),
  receipt_no        text not null unique,
  received_on       date not null,
  amount            numeric(14,2) not null check (amount > 0),
  mode              public.payment_mode not null,
  bank_name         text,
  instrument_no     text,
  instrument_date   date,
  instrument_status public.instrument_status not null default 'not_applicable',
  cleared_on        date,
  bounced_reason    text,
  received_by       uuid references public.profiles(id),
  payer_client_id   uuid references public.clients(id),
  status            public.record_status not null default 'valid',
  reversed_at       timestamptz,
  reversed_by       uuid references public.profiles(id),
  reversal_reason   text,
  notes             text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles(id),
  constraint payments_instrument_required check (mode in ('cash','online') or instrument_no is not null),
  constraint payments_instrument_status check (
    (mode in ('cash','online') and instrument_status = 'not_applicable')
    or (mode not in ('cash','online') and instrument_status <> 'not_applicable')),
  constraint payments_cleared_date check (instrument_status <> 'cleared' or cleared_on is not null),
  constraint payments_reversal_reason check (status = 'valid' or reversal_reason is not null)
);
create index payments_sale_idx on public.payments (sale_id);
create index payments_received_idx on public.payments (received_on);
create index payments_pending_idx on public.payments (project_id, instrument_date)
  where instrument_status = 'pending' and status = 'valid';
create trigger payments_touch before update on public.payments
  for each row execute function private.touch_updated_at();

create table public.payment_allocations (
  id             uuid primary key default gen_random_uuid(),
  payment_id     uuid not null references public.payments(id) on delete cascade,
  installment_id uuid not null references public.installments(id),
  amount         numeric(14,2) not null check (amount > 0),
  created_at     timestamptz not null default now(),
  created_by     uuid default auth.uid() references public.profiles(id),
  unique (payment_id, installment_id)
);
create index payment_allocations_installment_idx on public.payment_allocations (installment_id);

-- ---------------------------------------------------------------------------
-- Commission: Waystar earns its % as money is collected (not at booking)
-- ---------------------------------------------------------------------------
create table public.commissions (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references public.projects(id),
  sale_id         uuid references public.sales(id),
  lease_id        uuid,                                   -- Phase 4
  agent_id        uuid references public.profiles(id),
  dealer_id       uuid references public.dealers(id),
  base_amount     numeric(14,2) not null default 0,       -- final price (sales)
  rate_pct        numeric(5,2) not null check (rate_pct between 0 and 100),
  amount          numeric(14,2) not null default 0,       -- full commission if everything is collected
  earned_amount   numeric(14,2) not null default 0,       -- rate × cleared payments so far
  received_amount numeric(14,2) not null default 0,
  status          public.commission_status not null default 'pending',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles(id),
  constraint commission_one_source check ((sale_id is null) <> (lease_id is null))
);
create unique index commissions_sale_uq on public.commissions (sale_id) where sale_id is not null;
create index commissions_project_idx on public.commissions (project_id, status);
create trigger commissions_touch before update on public.commissions
  for each row execute function private.touch_updated_at();

create table public.commission_receipts (
  id            uuid primary key default gen_random_uuid(),
  commission_id uuid not null references public.commissions(id),
  received_on   date not null,
  amount        numeric(14,2) not null check (amount > 0),
  reference_no  text,
  status        public.record_status not null default 'valid',
  created_at    timestamptz not null default now(),
  created_by    uuid default auth.uid() references public.profiles(id)
);
create index commission_receipts_idx on public.commission_receipts (commission_id);

grant execute on all functions in schema private to authenticated, service_role;
