-- =============================================================================
-- Waystar Property Management Portal — SCHEMA PROPOSAL (draft for approval)
-- Postgres 15 / Supabase. After approval this is split into supabase/migrations/.
-- Conventions: uuid PKs, numeric(14,2) money, soft delete via deleted_at,
-- audit via activity_log triggers, RLS on every table.
-- =============================================================================

create extension if not exists pgcrypto;
create extension if not exists pg_cron;
create extension if not exists pg_trgm;           -- fuzzy search on names
create schema if not exists private;              -- NOT exposed through PostgREST

-- -----------------------------------------------------------------------------
-- ENUMS
-- -----------------------------------------------------------------------------
create type app_role           as enum ('super_admin','manager','sales_agent','accounts','viewer','client');
create type project_type       as enum ('plot_society','high_rise');
create type project_status     as enum ('off_plan','under_construction','completed');
create type block_kind         as enum ('block','tower','phase','sector');
create type unit_category      as enum ('plot','apartment','shop','office','penthouse','other');
create type unit_use           as enum ('residential','commercial');
create type size_unit          as enum ('marla','kanal','sqft');
create type unit_status        as enum ('available','on_hold','booked','sold','rented','blocked');
create type sale_status        as enum ('booked','active','completed','cancelled','transferred');
create type plan_kind          as enum ('full_cash','installment');
create type plan_frequency     as enum ('monthly','quarterly','bi_annual','annual');
create type installment_type   as enum ('down_payment','installment','possession','balloon','other');
create type installment_status as enum ('pending','partially_paid','paid','overdue','waived');
create type payment_mode       as enum ('cash','cheque','pay_order','bank_transfer','online');
create type instrument_status  as enum ('not_applicable','pending','cleared','bounced');
create type record_status      as enum ('valid','reversed');
create type possession_status  as enum ('not_due','eligible','requested','given');
create type workflow_status    as enum ('draft','pending_approval','approved','completed','rejected');
create type refund_status      as enum ('pending','partially_paid','paid');
create type ownership_via      as enum ('booking','transfer','correction');
create type lease_status       as enum ('draft','active','expired','terminated','renewed');
create type invoice_status     as enum ('pending','partially_paid','paid','overdue','waived');
create type lease_event_type   as enum ('created','renewal','rent_revision','increment_applied','notice',
                                        'termination','deposit_refund','damage_deduction','note');
create type deposit_txn_type   as enum ('received','refunded','deducted','adjusted');
create type commission_status  as enum ('pending','partially_received','received','cancelled');
create type approval_kind      as enum ('discount','cancellation','transfer','possession_override',
                                        'schedule_edit','waiver','refund');
create type approval_status    as enum ('pending','approved','rejected');
create type audit_action       as enum ('insert','update','delete');

-- -----------------------------------------------------------------------------
-- SHARED TRIGGER: updated_at
-- -----------------------------------------------------------------------------
create or replace function private.touch_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at := now(); return new; end $$;

-- =============================================================================
-- 1. IDENTITY, ROLES, SETTINGS
-- =============================================================================
create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null,
  email       text,
  phone       text,
  role        app_role not null default 'viewer',
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table company_settings (
  id              boolean primary key default true check (id),   -- singleton row
  company_name    text not null default 'Waystar Royco Marketing',
  partner_name    text not null default 'SIMCO Developers',
  address         text, phone text, email text, website text,
  logo_path       text,
  default_sale_commission_pct  numeric(5,2) not null default 5.00,
  default_lease_commission_pct numeric(5,2) not null default 5.00,
  default_rent_increment_pct   numeric(5,2) not null default 10.00,
  discount_approval_threshold_pct numeric(5,2) not null default 0.00,   -- see Q12
  updated_at      timestamptz not null default now()
);

-- =============================================================================
-- 2. INVENTORY
-- =============================================================================
create table projects (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  code           text not null unique,                 -- SV, SSQ, VIN, RES, MER
  type           project_type not null,
  status         project_status not null default 'under_construction',
  location       text,
  description    text,
  cover_image_path text,
  logo_path      text,
  sqft_per_marla numeric(8,2) not null default 225.00, -- Q1
  marla_per_kanal numeric(5,2) not null default 20,
  is_active      boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references profiles(id), deleted_at timestamptz
);

create table user_project_access (
  user_id    uuid not null references profiles(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  primary key (user_id, project_id)
);

create table blocks (                                   -- Block A / Tower 1
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references projects(id),
  name        text not null,
  kind        block_kind not null default 'block',
  sort_order  int not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references profiles(id), deleted_at timestamptz,
  unique (project_id, name)
);

create table floors (
  id          uuid primary key default gen_random_uuid(),
  block_id    uuid not null references blocks(id),
  label       text not null,                           -- Basement, Ground, Mezzanine, 1..n
  level       int  not null,                           -- -1, 0, 0 (mezz uses sort_order), 1..n
  sort_order  int  not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references profiles(id), deleted_at timestamptz,
  unique (block_id, label)
);

create table units (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references projects(id),
  block_id      uuid references blocks(id),
  floor_id      uuid references floors(id),            -- null for plots
  street        text,                                  -- plots only
  unit_no       text not null,
  category      unit_category not null,
  use           unit_use not null,
  size_value    numeric(10,2) not null check (size_value > 0),
  size_unit     size_unit not null,
  area_sqft     numeric(12,2) not null,                -- normalized, set by trigger
  bedrooms      smallint,
  bathrooms     smallint,
  is_corner     boolean not null default false,
  is_park_facing boolean not null default false,
  is_main_boulevard boolean not null default false,
  base_price    numeric(14,2) not null check (base_price >= 0),
  price_per_sqft numeric(14,2),
  status        unit_status not null default 'available',
  notes         text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references profiles(id), deleted_at timestamptz
);
create unique index units_unique_no on units (project_id, coalesce(block_id,'00000000-0000-0000-0000-000000000000'), coalesce(street,''), unit_no) where deleted_at is null;
create index on units (project_id, status);
create index on units (block_id); create index on units (floor_id);
create index on units (category);

-- =============================================================================
-- 3. CLIENTS & DEALERS
-- =============================================================================
create table clients (
  id              uuid primary key default gen_random_uuid(),
  full_name       text not null,
  relation_type   text check (relation_type in ('s/o','d/o','w/o')),
  guardian_name   text,                                -- father / husband
  cnic            text check (cnic ~ '^\d{5}-\d{7}-\d$'),
  passport_no     text,
  nationality     text not null default 'Pakistani',
  is_overseas     boolean not null default false,
  phone           text not null,
  whatsapp        text,
  email           text,
  address         text,
  city            text,
  country         text not null default 'Pakistan',
  nok_name text, nok_cnic text check (nok_cnic ~ '^\d{5}-\d{7}-\d$'), nok_relation text, nok_phone text,
  photo_path      text,
  cnic_front_path text,
  cnic_back_path  text,
  auth_user_id    uuid unique references auth.users(id),   -- future client portal
  notes           text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references profiles(id), deleted_at timestamptz,
  constraint client_identity check (cnic is not null or passport_no is not null)
);
create unique index clients_cnic_uq on clients (cnic) where cnic is not null and deleted_at is null;
create index on clients (phone);
create index clients_name_trgm on clients using gin (full_name gin_trgm_ops);

create table dealers (                                   -- external agents / dealers
  id uuid primary key default gen_random_uuid(),
  name text not null, agency text, phone text, cnic text, email text,
  default_commission_pct numeric(5,2),
  is_active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references profiles(id), deleted_at timestamptz
);

-- =============================================================================
-- 4. PAYMENT PLANS & SALES
-- =============================================================================
create table payment_plans (
  id                 uuid primary key default gen_random_uuid(),
  project_id         uuid references projects(id),     -- null = available to all projects
  name               text not null,                    -- "SIMCO Standard 24M Monthly"
  kind               plan_kind not null,
  down_payment_pct   numeric(5,2) not null default 40,
  installment_pct    numeric(5,2) not null default 50,
  possession_pct     numeric(5,2) not null default 10,
  tenure_months      smallint check (tenure_months in (12,24) or tenure_months is null),
  frequency          plan_frequency,
  is_active          boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references profiles(id), deleted_at timestamptz,
  constraint pct_total check (down_payment_pct + installment_pct + possession_pct = 100),
  constraint inst_fields check (kind = 'full_cash' or (tenure_months is not null and frequency is not null))
);

create table sales (
  id                 uuid primary key default gen_random_uuid(),
  unit_id            uuid not null references units(id),
  project_id         uuid not null references projects(id),     -- denormalized for RLS/reports
  booking_form_no    text not null,
  booking_date       date not null,
  list_price         numeric(14,2) not null check (list_price >= 0),
  discount           numeric(14,2) not null default 0 check (discount >= 0),
  final_price        numeric(14,2) generated always as (list_price - discount) stored,
  plan_kind          plan_kind not null,
  payment_plan_id    uuid references payment_plans(id),
  -- snapshot of plan terms at booking (template may change later)
  down_payment_pct   numeric(5,2), installment_pct numeric(5,2), possession_pct numeric(5,2),
  tenure_months      smallint, frequency plan_frequency,
  first_installment_date date,
  is_custom_schedule boolean not null default false,
  agent_id           uuid references profiles(id),
  dealer_id          uuid references dealers(id),
  commission_pct     numeric(5,2) not null default 5.00,
  status             sale_status not null default 'booked',
  discount_approval_id uuid,                                   -- fk to approvals
  notes              text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references profiles(id), deleted_at timestamptz,
  constraint discount_le_price check (discount <= list_price),
  unique (project_id, booking_form_no)
);
-- one live sale per unit
create unique index sales_one_live_per_unit on sales (unit_id)
  where status in ('booked','active') and deleted_at is null;
create index on sales (project_id, status); create index on sales (agent_id); create index on sales (booking_date);

create table sale_buyers (                                  -- joint ownership
  sale_id    uuid not null references sales(id) on delete cascade,
  client_id  uuid not null references clients(id),
  share_pct  numeric(5,2) not null check (share_pct > 0 and share_pct <= 100),
  is_primary boolean not null default false,
  primary key (sale_id, client_id)
);
create index on sale_buyers (client_id);
-- deferred constraint trigger: sum(share_pct) per sale = 100, exactly one primary

create table unit_ownerships (                              -- time-sliced ownership history
  id           uuid primary key default gen_random_uuid(),
  unit_id      uuid not null references units(id),
  sale_id      uuid not null references sales(id),
  client_id    uuid not null references clients(id),
  share_pct    numeric(5,2) not null,
  valid_from   date not null,
  valid_to     date,                                        -- null = current owner
  acquired_via ownership_via not null,
  transfer_id  uuid,                                        -- fk to ownership_transfers
  created_at   timestamptz not null default now(),
  created_by   uuid default auth.uid() references profiles(id)
);
create index on unit_ownerships (unit_id, valid_to);
create index on unit_ownerships (client_id);

create table installments (
  id             uuid primary key default gen_random_uuid(),
  sale_id        uuid not null references sales(id),
  seq            smallint not null,
  type           installment_type not null,
  label          text,                                    -- "Installment 3 of 24"
  due_date       date,                                    -- null allowed for possession (Q3)
  amount_due     numeric(14,2) not null check (amount_due >= 0),
  amount_paid    numeric(14,2) not null default 0,        -- maintained from allocations
  late_fee       numeric(14,2) not null default 0,
  waived_amount  numeric(14,2) not null default 0,
  status         installment_status not null default 'pending',
  days_overdue   int not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references profiles(id), deleted_at timestamptz,
  unique (sale_id, seq)
);
create index on installments (due_date) where status in ('pending','partially_paid','overdue');
create index on installments (sale_id, status);

-- =============================================================================
-- 5. PAYMENTS & RECEIPTS
-- =============================================================================
create table doc_sequences (
  project_id uuid not null references projects(id),
  doc_type   text not null,          -- RCPT, RRCPT, BKF, POSS, NDC, TRF, ALLOT, REF
  year       smallint not null,
  last_no    int not null default 0,
  primary key (project_id, doc_type, year)
);
-- next_doc_no(project_id, doc_type) -> 'SV-RCPT-2026-000123' (SELECT ... FOR UPDATE)

create table payments (
  id               uuid primary key default gen_random_uuid(),
  project_id       uuid not null references projects(id),
  sale_id          uuid not null references sales(id),
  receipt_no       text not null unique,
  received_on      date not null,
  amount           numeric(14,2) not null check (amount > 0),
  mode             payment_mode not null,
  bank_name        text,
  instrument_no    text,
  instrument_date  date,
  instrument_status instrument_status not null default 'not_applicable',
  cleared_on       date,
  bounced_reason   text,
  received_by      uuid references profiles(id),
  payer_client_id  uuid references clients(id),
  status           record_status not null default 'valid',
  reversed_at      timestamptz, reversed_by uuid references profiles(id), reversal_reason text,
  notes            text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references profiles(id),
  constraint instrument_required check (mode in ('cash','online') or instrument_no is not null),
  constraint reversal_reason_req check (status = 'valid' or reversal_reason is not null)
);
create index on payments (sale_id); create index on payments (received_on);
create index on payments (instrument_status) where instrument_status = 'pending';
-- trigger: BEFORE DELETE raise exception 'payments cannot be deleted; use reverse_payment()'
-- trigger: amount/sale_id immutable after insert

create table payment_allocations (
  id             uuid primary key default gen_random_uuid(),
  payment_id     uuid not null references payments(id),
  installment_id uuid not null references installments(id),
  amount         numeric(14,2) not null check (amount > 0),
  created_at     timestamptz not null default now(),
  created_by     uuid default auth.uid() references profiles(id),
  unique (payment_id, installment_id)
);
create index on payment_allocations (installment_id);
-- constraint trigger: sum(allocations) <= payment.amount; installment not over-allocated

-- =============================================================================
-- 6. POSSESSION, TRANSFERS, CANCELLATIONS
-- =============================================================================
create table possessions (
  id               uuid primary key default gen_random_uuid(),
  sale_id          uuid not null unique references sales(id),
  status           possession_status not null default 'not_due',
  eligible_on      date,
  override_approval_id uuid,
  requested_on     date,
  possession_date  date,
  letter_no        text unique,
  handed_over_by   uuid references profiles(id),
  electricity_meter_no text, electricity_reading numeric(12,2),
  gas_meter_no     text, gas_reading numeric(12,2),
  water_meter_no   text, water_reading numeric(12,2),
  keys_handed      smallint,
  remarks          text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references profiles(id), deleted_at timestamptz
);

create table ownership_transfers (
  id              uuid primary key default gen_random_uuid(),
  unit_id         uuid not null references units(id),
  sale_id         uuid not null references sales(id),
  transfer_no     text unique,
  transfer_date   date,
  transfer_fee    numeric(14,2) not null default 0,
  fee_receipt_no  text,
  ndc_issued      boolean not null default false,
  ndc_no          text unique,
  ndc_date        date,
  status          workflow_status not null default 'draft',
  approval_id     uuid,
  notes           text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references profiles(id), deleted_at timestamptz
);
create table transfer_parties (
  transfer_id uuid not null references ownership_transfers(id) on delete cascade,
  client_id   uuid not null references clients(id),
  side        text not null check (side in ('from','to')),
  share_pct   numeric(5,2) not null,
  primary key (transfer_id, client_id, side)
);
alter table unit_ownerships add foreign key (transfer_id) references ownership_transfers(id);

create table cancellations (
  id               uuid primary key default gen_random_uuid(),
  sale_id          uuid not null unique references sales(id),
  requested_on     date not null,
  reason           text not null,
  total_paid       numeric(14,2) not null,           -- snapshot at cancellation
  deduction_amount numeric(14,2) not null default 0,
  refund_amount    numeric(14,2) generated always as (total_paid - deduction_amount) stored,
  status           workflow_status not null default 'pending_approval',
  refund_status    refund_status not null default 'pending',
  approval_id      uuid,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references profiles(id), deleted_at timestamptz,
  constraint deduction_le_paid check (deduction_amount <= total_paid)
);
create table refunds (
  id               uuid primary key default gen_random_uuid(),
  cancellation_id  uuid not null references cancellations(id),
  voucher_no       text not null unique,
  paid_on          date not null,
  amount           numeric(14,2) not null check (amount > 0),
  mode             payment_mode not null,
  bank_name text, instrument_no text,
  status           record_status not null default 'valid',
  reversed_at timestamptz, reversed_by uuid references profiles(id), reversal_reason text,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid() references profiles(id)
);

-- =============================================================================
-- 7. RENTALS
-- =============================================================================
create table leases (
  id                 uuid primary key default gen_random_uuid(),
  unit_id            uuid not null references units(id),
  project_id         uuid not null references projects(id),
  agreement_no       text not null unique,
  landlord_client_id uuid references clients(id),        -- null = SIMCO-owned (Q13)
  tenant_client_id   uuid not null references clients(id),
  start_date         date not null,
  end_date           date not null,
  monthly_rent       numeric(14,2) not null check (monthly_rent > 0),   -- starting rent
  current_rent       numeric(14,2) not null,                             -- after increments
  security_deposit   numeric(14,2) not null default 0,
  advance_months     smallint not null default 0,
  increment_pct      numeric(5,2) not null default 10.00,
  rent_due_day       smallint not null default 1 check (rent_due_day between 1 and 28),
  maintenance_charges numeric(14,2) not null default 0,
  maintenance_paid_by text not null default 'tenant' check (maintenance_paid_by in ('tenant','owner')),
  commission_pct     numeric(5,2) not null default 5.00,
  agent_id           uuid references profiles(id),
  dealer_id          uuid references dealers(id),
  status             lease_status not null default 'active',
  renewed_from_id    uuid references leases(id),
  terminated_on      date, termination_reason text,
  notes              text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references profiles(id), deleted_at timestamptz,
  constraint lease_dates check (end_date > start_date)
);
create unique index leases_one_active_per_unit on leases (unit_id) where status = 'active' and deleted_at is null;
create index on leases (end_date) where status = 'active';
create index on leases (tenant_client_id); create index on leases (landlord_client_id);

create table rent_invoices (
  id            uuid primary key default gen_random_uuid(),
  lease_id      uuid not null references leases(id),
  invoice_no    text not null unique,
  period        date not null,                           -- first day of month
  rent_amount   numeric(14,2) not null,
  maintenance_amount numeric(14,2) not null default 0,
  late_fee      numeric(14,2) not null default 0,
  amount_due    numeric(14,2) generated always as (rent_amount + maintenance_amount + late_fee) stored,
  amount_paid   numeric(14,2) not null default 0,
  waived_amount numeric(14,2) not null default 0,
  due_date      date not null,
  status        invoice_status not null default 'pending',
  days_overdue  int not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references profiles(id),
  unique (lease_id, period)
);
create index on rent_invoices (due_date) where status in ('pending','partially_paid','overdue');

create table rent_payments (
  id               uuid primary key default gen_random_uuid(),
  lease_id         uuid not null references leases(id),
  project_id       uuid not null references projects(id),
  receipt_no       text not null unique,
  received_on      date not null,
  amount           numeric(14,2) not null check (amount > 0),
  mode             payment_mode not null,
  bank_name text, instrument_no text, instrument_date date,
  instrument_status instrument_status not null default 'not_applicable',
  cleared_on date,
  received_by      uuid references profiles(id),
  status           record_status not null default 'valid',
  reversed_at timestamptz, reversed_by uuid references profiles(id), reversal_reason text,
  notes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references profiles(id)
);
create table rent_payment_allocations (
  id              uuid primary key default gen_random_uuid(),
  rent_payment_id uuid not null references rent_payments(id),
  rent_invoice_id uuid not null references rent_invoices(id),
  amount          numeric(14,2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  unique (rent_payment_id, rent_invoice_id)
);

create table deposit_transactions (
  id          uuid primary key default gen_random_uuid(),
  lease_id    uuid not null references leases(id),
  type        deposit_txn_type not null,
  txn_date    date not null,
  amount      numeric(14,2) not null check (amount > 0),
  reason      text,
  reference_no text,
  status      record_status not null default 'valid',
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid() references profiles(id)
);

create table lease_events (
  id          uuid primary key default gen_random_uuid(),
  lease_id    uuid not null references leases(id),
  type        lease_event_type not null,
  event_date  date not null,
  old_rent    numeric(14,2), new_rent numeric(14,2),
  amount      numeric(14,2),
  details     text,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid() references profiles(id)
);

-- =============================================================================
-- 8. MAINTENANCE (ALLIED) CHARGES
-- =============================================================================
create table maintenance_rates (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null references projects(id),
  category       unit_category,                        -- null = all categories
  rate_per_sqft  numeric(10,2) not null,
  effective_from date not null,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid() references profiles(id)
);
create table maintenance_charges (
  id            uuid primary key default gen_random_uuid(),
  unit_id       uuid not null references units(id),
  billed_client_id uuid references clients(id),
  period        date not null,
  area_sqft     numeric(12,2) not null,
  rate_per_sqft numeric(10,2) not null,
  amount        numeric(14,2) not null,
  amount_paid   numeric(14,2) not null default 0,
  status        invoice_status not null default 'pending',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references profiles(id),
  unique (unit_id, period)
);

-- =============================================================================
-- 9. COMMISSIONS, TARGETS, APPROVALS, DOCUMENTS, AUDIT
-- =============================================================================
create table commissions (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null references projects(id),
  sale_id        uuid references sales(id),
  lease_id       uuid references leases(id),
  agent_id       uuid references profiles(id),
  dealer_id      uuid references dealers(id),
  base_amount    numeric(14,2) not null,
  rate_pct       numeric(5,2) not null,
  amount         numeric(14,2) not null,
  received_amount numeric(14,2) not null default 0,
  status         commission_status not null default 'pending',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references profiles(id),
  constraint one_source check ((sale_id is null) <> (lease_id is null))
);
create table commission_receipts (
  id            uuid primary key default gen_random_uuid(),
  commission_id uuid not null references commissions(id),
  received_on   date not null,
  amount        numeric(14,2) not null check (amount > 0),
  reference_no  text,
  status        record_status not null default 'valid',
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid() references profiles(id)
);

create table collection_targets (
  project_id uuid not null references projects(id),
  month      date not null,                               -- first of month
  target_amount numeric(14,2) not null,
  primary key (project_id, month)
);

create table approvals (
  id           uuid primary key default gen_random_uuid(),
  kind         approval_kind not null,
  entity_type  text not null,
  entity_id    uuid not null,
  project_id   uuid references projects(id),
  payload      jsonb not null default '{}',               -- requested change
  reason       text not null,
  status       approval_status not null default 'pending',
  requested_by uuid not null default auth.uid() references profiles(id),
  requested_at timestamptz not null default now(),
  decided_by   uuid references profiles(id),
  decided_at   timestamptz,
  decision_note text
);
create index on approvals (status, kind);

create table documents (                                  -- polymorphic attachments
  id           uuid primary key default gen_random_uuid(),
  entity_type  text not null check (entity_type in ('client','sale','lease','unit','transfer','possession','cancellation','payment')),
  entity_id    uuid not null,
  project_id   uuid references projects(id),
  doc_type     text not null,                             -- cnic_front, booking_form, agreement, photo...
  bucket       text not null,
  storage_path text not null unique,
  file_name    text not null,
  mime_type    text, size_bytes bigint,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid() references profiles(id), deleted_at timestamptz
);
create index on documents (entity_type, entity_id);

create table issued_documents (                           -- printed PDFs + QR verification
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid references projects(id),
  doc_type     text not null,                             -- receipt, booking_form, possession_letter, ndc...
  doc_no       text not null,
  entity_type  text not null,
  entity_id    uuid not null,
  verify_token text not null unique default encode(gen_random_bytes(16),'hex'),
  issued_at    timestamptz not null default now(),
  issued_by    uuid default auth.uid() references profiles(id),
  is_void      boolean not null default false,
  unique (doc_type, doc_no)
);

create table activity_log (
  id          bigint generated always as identity primary key,
  table_name  text not null,
  record_id   uuid,
  action      audit_action not null,
  old_data    jsonb,
  new_data    jsonb,
  reason      text,                                       -- current_setting('app.reason', true)
  changed_by  uuid,
  changed_at  timestamptz not null default now()
);
create index on activity_log (table_name, record_id);
create index on activity_log (changed_at desc);
-- audit_row() attached AFTER INSERT/UPDATE/DELETE on: units, clients, sales, sale_buyers,
-- unit_ownerships, installments, payments, payment_allocations, possessions,
-- ownership_transfers, cancellations, refunds, leases, rent_invoices, rent_payments,
-- deposit_transactions, commissions, approvals. activity_log itself: insert-only (no UPDATE/DELETE grants).

-- =============================================================================
-- 10. HELPER FUNCTIONS (private schema, security definer, search_path = '')
-- =============================================================================
create or replace function private.my_role() returns app_role
language sql stable security definer set search_path = '' as $$
  select role from public.profiles where id = auth.uid() and is_active
$$;

create or replace function private.has_role(variadic roles app_role[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(private.my_role() = any(roles), false)
$$;

create or replace function private.can_access_project(p uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.has_role('super_admin','manager')
      or exists (select 1 from public.user_project_access a
                 where a.user_id = auth.uid() and a.project_id = p)
$$;

create or replace function private.my_client_id() returns uuid      -- future client portal
language sql stable security definer set search_path = '' as $$
  select id from public.clients where auth_user_id = auth.uid()
$$;

-- Business functions (bodies written in Phase 2–5; signatures fixed now):
--   public.next_doc_no(p_project uuid, p_doc_type text) returns text
--   public.create_sale(p jsonb) returns uuid                      -- wizard confirm, atomic
--   public.generate_installment_schedule(p_sale uuid) returns setof installments
--   public.edit_installment(p_id uuid, p_due_date date, p_amount numeric, p_reason text)
--   public.record_payment(p jsonb) returns uuid                   -- inserts + auto-allocates
--   public.allocate_payment(p_payment uuid)                        -- oldest due first
--   public.set_payment_allocations(p_payment uuid, p_alloc jsonb, p_reason text)
--   public.clear_instrument(p_payment uuid, p_cleared_on date) / bounce_instrument(p_payment, p_reason)
--   public.reverse_payment(p_payment uuid, p_reason text)
--   private.recompute_installment(p_installment uuid)              -- paid/status from allocations
--   private.refresh_unit_status(p_unit uuid)
--   private.refresh_possession_eligibility(p_sale uuid)
--   public.complete_transfer(p_transfer uuid)                      -- closes/opens unit_ownerships
--   public.approve(p_approval uuid, p_note text) / reject(...)
--   public.mark_overdue()                                          -- pg_cron
--   public.generate_rent_invoices(p_month date)                    -- pg_cron
--   public.apply_lease_increments(p_on date)                       -- pg_cron
-- All mutating functions are SECURITY INVOKER (so RLS applies) except those that
-- must update derived columns (recompute_*, refresh_*), which are SECURITY DEFINER in private.

-- =============================================================================
-- 11. REPORTING VIEWS (security_invoker = true so RLS applies)
-- =============================================================================
create view v_sale_ledger with (security_invoker = true) as
select s.id as sale_id, s.project_id, s.unit_id, s.final_price,
       coalesce(sum(i.amount_paid),0)                                   as total_paid,
       s.final_price - coalesce(sum(i.amount_paid + i.waived_amount),0) as balance,
       coalesce(sum(i.amount_due - i.amount_paid - i.waived_amount)
                filter (where i.status = 'overdue'),0)                  as overdue_amount,
       min(i.due_date) filter (where i.status in ('pending','partially_paid','overdue')) as next_due_date,
       round(100 * coalesce(sum(i.amount_paid),0) / nullif(s.final_price,0), 2) as pct_paid
from sales s left join installments i on i.sale_id = s.id and i.deleted_at is null
where s.deleted_at is null
group by s.id;

create view v_unit_current_owners with (security_invoker = true) as
select o.unit_id, o.client_id, o.share_pct, o.sale_id, o.valid_from
from unit_ownerships o where o.valid_to is null;

-- Also planned: v_receivables_aging (0–30/31–60/61–90/90+), v_dashboard_project_kpis,
-- v_collections_by_month, v_rent_roll, v_commission_summary, v_cheque_register.

-- =============================================================================
-- 12. ROW LEVEL SECURITY (representative policies; same pattern on every table)
-- =============================================================================
alter table projects enable row level security;
alter table units    enable row level security;
alter table clients  enable row level security;
alter table sales    enable row level security;
alter table payments enable row level security;
-- ... enable on ALL tables listed above.

create policy projects_read on projects for select to authenticated
  using (private.can_access_project(id));
create policy projects_write on projects for all to authenticated
  using (private.has_role('super_admin','manager')) with check (private.has_role('super_admin','manager'));

create policy units_read on units for select to authenticated
  using (deleted_at is null and private.can_access_project(project_id));
create policy units_write on units for insert to authenticated
  with check (private.has_role('super_admin','manager') and private.can_access_project(project_id));
create policy units_update on units for update to authenticated
  using (private.has_role('super_admin','manager') and private.can_access_project(project_id));
-- (status column updated only by private.refresh_unit_status)

create policy sales_read on sales for select to authenticated using (
  deleted_at is null and private.can_access_project(project_id) and (
    private.has_role('super_admin','manager','accounts','viewer')
    or (private.has_role('sales_agent') and agent_id = auth.uid())
    or exists (select 1 from sale_buyers b where b.sale_id = sales.id
               and b.client_id = private.my_client_id())          -- client portal
  ));
create policy sales_insert on sales for insert to authenticated with check (
  private.can_access_project(project_id)
  and (private.has_role('super_admin','manager')
       or (private.has_role('sales_agent') and agent_id = auth.uid())));
create policy sales_update on sales for update to authenticated
  using (private.has_role('super_admin','manager') and private.can_access_project(project_id));
-- no DELETE policy for anyone (soft delete via update by super_admin)

create policy payments_read on payments for select to authenticated using (
  private.can_access_project(project_id) and (
    private.has_role('super_admin','manager','accounts','viewer')
    or exists (select 1 from sales s where s.id = payments.sale_id and s.agent_id = auth.uid())
    or exists (select 1 from sale_buyers b where b.sale_id = payments.sale_id
               and b.client_id = private.my_client_id())));
create policy payments_insert on payments for insert to authenticated
  with check (private.has_role('super_admin','accounts') and private.can_access_project(project_id));
create policy payments_update on payments for update to authenticated
  using (private.has_role('super_admin','accounts') and private.can_access_project(project_id));
-- no DELETE policy + BEFORE DELETE trigger raising an exception (defence in depth)

create policy clients_read on clients for select to authenticated using (
  deleted_at is null and (
    private.has_role('super_admin','manager','accounts','viewer')
    or (private.has_role('sales_agent') and (created_by = auth.uid()
        or exists (select 1 from sale_buyers b join sales s on s.id = b.sale_id
                   where b.client_id = clients.id and s.agent_id = auth.uid())))
    or auth_user_id = auth.uid()));
-- CNIC duplicate check for agents via public.client_exists_by_cnic(cnic) -> boolean (definer, no PII leak)

-- Storage: buckets private; storage.objects policies check that the first path segment
-- (entity_type) + second (entity_id) belong to a row the user can read.

-- =============================================================================
-- 13. CRON (Phase 5) — times in UTC (PKT = UTC+5)
-- =============================================================================
-- select cron.schedule('mark-overdue',        '30 19 * * *', $$select public.mark_overdue()$$);
-- select cron.schedule('rent-invoices',       '0 20 * * *',  $$select public.generate_rent_invoices(date_trunc('month', now() at time zone 'Asia/Karachi')::date)$$);
-- select cron.schedule('lease-increments',    '30 20 * * *', $$select public.apply_lease_increments((now() at time zone 'Asia/Karachi')::date)$$);
