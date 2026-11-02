-- Phase 3 (schema): possession, transfers, cancellations.
--
-- Rules from docs/02-business-rules.md:
--   * Possession only after full payment and clearance of dues. The allottee may report
--     dimension discrepancies within project_document_settings.discrepancy_report_days.
--   * Two consecutive missed installments FLAG a sale (Phase 2 already does this). A Manager
--     confirms the cancellation; nothing is ever cancelled automatically.
--   * On cancellation the Seller deducts projects.cancellation_deduction_pct (20% for Simco
--     Villas) of the TOTAL SALE PRICE, and refunds the balance of what was received only
--     AFTER the plot has been re-sold, within refund_days_after_resale of that re-sale.
--   * Transfer of allotment needs the Company's written approval and a processing fee.
--
-- Money here follows the Phase 2 rules: numeric(14,2) throughout, every figure derived in
-- the database, and nothing hard-deleted.

-- A refund is not payable the moment a booking is cancelled: it waits for the re-sale.
create type public.refund_status as enum ('pending_resale', 'payable', 'paid', 'waived');

-- ---------------------------------------------------------------------------
-- Possession
-- ---------------------------------------------------------------------------
create table public.possessions (
  id                   uuid primary key default gen_random_uuid(),
  sale_id              uuid not null unique references public.sales(id),
  project_id           uuid not null references public.projects(id),
  unit_id              uuid not null references public.units(id),
  letter_no            text not null unique,
  handover_date        date not null,
  dues_cleared_date    date,
  -- handover_date + the project's discrepancy window; after this the record is final
  discrepancy_deadline date,
  notes                text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles(id), deleted_at timestamptz,
  constraint possession_deadline_after_handover
    check (discrepancy_deadline is null or discrepancy_deadline >= handover_date)
);
create index possessions_project_idx on public.possessions (project_id, handover_date);
create index possessions_unit_idx on public.possessions (unit_id);
create trigger possessions_touch before update on public.possessions
  for each row execute function private.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Transfers — the sale continues; only who owns it changes.
-- Keeping one sale preserves the schedule, the receipts and the ledger, which is what the
-- buyer and SIMCO both need to see after a transfer.
-- ---------------------------------------------------------------------------
create table public.transfers (
  id            uuid primary key default gen_random_uuid(),
  sale_id       uuid not null references public.sales(id),
  project_id    uuid not null references public.projects(id),
  unit_id       uuid not null references public.units(id),
  transfer_no   text not null unique,
  transfer_date date not null,
  transfer_fee  numeric(14,2) not null default 0 check (transfer_fee >= 0),
  reason        text not null,
  notes         text,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles(id)
);
create index transfers_sale_idx on public.transfers (sale_id, transfer_date);
create index transfers_unit_idx on public.transfers (unit_id);

-- unit_ownerships.transfer_id was reserved in Phase 2; wire it up now.
alter table public.unit_ownerships
  add constraint unit_ownerships_transfer_fk
  foreign key (transfer_id) references public.transfers(id);

-- ---------------------------------------------------------------------------
-- Cancellations
-- ---------------------------------------------------------------------------
create table public.cancellations (
  id                uuid primary key default gen_random_uuid(),
  sale_id           uuid not null unique references public.sales(id),
  project_id        uuid not null references public.projects(id),
  unit_id           uuid not null references public.units(id),
  cancellation_no   text not null unique,
  cancelled_on      date not null,
  reason            text not null,
  -- frozen at cancellation: later activity must not silently restate the refund
  amount_received   numeric(14,2) not null check (amount_received >= 0),
  sale_price        numeric(14,2) not null check (sale_price >= 0),
  deduction_pct     numeric(5,2)  not null check (deduction_pct between 0 and 100),
  deduction_amount  numeric(14,2) not null check (deduction_amount >= 0),
  refund_due        numeric(14,2) not null check (refund_due >= 0),
  refund_status     public.refund_status not null default 'pending_resale',
  -- the re-sale that makes the refund payable, and the deadline it creates
  resold_sale_id    uuid references public.sales(id),
  refund_due_date   date,
  refunded_on       date,
  refund_reference  text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles(id),
  constraint cancellation_refund_paid check (refund_status <> 'paid' or refunded_on is not null)
);
create index cancellations_project_idx on public.cancellations (project_id, refund_status);
create index cancellations_unit_pending_idx on public.cancellations (unit_id)
  where refund_status in ('pending_resale', 'payable');
create trigger cancellations_touch before update on public.cancellations
  for each row execute function private.touch_updated_at();
