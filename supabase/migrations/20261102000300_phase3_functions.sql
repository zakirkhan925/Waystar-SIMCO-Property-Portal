-- Phase 3 (logic): possession, transfers, cancellations.
--
-- Same contract as Phase 2: every one of these is SECURITY DEFINER and checks the caller
-- itself, the tables stay read-only through the API, and all money is derived here.

-- What a sale still owes, penalties included. Zero or less means fully settled.
create or replace function private.sale_outstanding(p_sale uuid) returns numeric
language sql stable security definer set search_path = '' as $$
  select coalesce(sum(i.amount_due + i.late_fee - i.amount_paid - i.waived_amount - i.late_fee_paid), 0)
  from public.installments i
  where i.sale_id = p_sale and i.deleted_at is null
$$;

-- ---------------------------------------------------------------------------
-- Possession: only once the sale is paid off in full.
-- ---------------------------------------------------------------------------
create or replace function public.grant_possession(p jsonb)
returns public.possessions
language plpgsql security definer set search_path = '' as $$
declare
  v_sale public.sales; v_row public.possessions;
  v_outstanding numeric(14,2); v_days smallint; v_on date; v_reason text;
begin
  select * into v_sale from public.sales where id = (p->>'sale_id')::uuid and deleted_at is null;
  if v_sale.id is null then
    raise exception 'Sale not found' using errcode = '42501';
  end if;
  if not private.has_role('super_admin','manager') then
    raise exception 'Only a Manager can hand over possession' using errcode = '42501';
  end if;
  if not private.can_access_project(v_sale.project_id) then
    raise exception 'Not permitted' using errcode = '42501';
  end if;
  if v_sale.status not in ('booked','active') then
    raise exception 'This sale is %, so possession cannot be handed over', v_sale.status;
  end if;

  -- "Possession only after full payment and applicable maintenance charges are cleared."
  v_outstanding := private.sale_outstanding(v_sale.id);
  if v_outstanding > 0 then
    raise exception 'This sale still owes %. Possession needs the account cleared first.', v_outstanding;
  end if;

  v_reason := nullif(trim(p->>'notes'), '');
  v_on := coalesce(nullif(p->>'handover_date','')::date, private.today_pk());
  perform set_config('app.reason', 'Possession handed over', true);

  select s.discrepancy_report_days into v_days
  from public.project_document_settings s where s.project_id = v_sale.project_id;

  insert into public.possessions (sale_id, project_id, unit_id, letter_no, handover_date,
                                  dues_cleared_date, discrepancy_deadline, notes, created_by)
  values (v_sale.id, v_sale.project_id, v_sale.unit_id,
          public.next_doc_no(v_sale.project_id, 'PL'),
          v_on,
          coalesce(nullif(p->>'dues_cleared_date','')::date, v_on),
          case when v_days is not null then v_on + v_days end,
          v_reason, auth.uid())
  returning * into v_row;

  -- The sale is done: paid in full and handed over.
  update public.sales set status = 'completed' where id = v_sale.id;
  perform private.refresh_sale(v_sale.id);
  return v_row;
end $$;
revoke execute on function public.grant_possession(jsonb) from anon, public;
grant execute on function public.grant_possession(jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Transfer: the sale continues, only the owners change. Keeping one sale preserves
-- the schedule, the receipts and the ledger, which both SIMCO and the new buyer need.
-- ---------------------------------------------------------------------------
create or replace function public.transfer_sale(p jsonb)
returns public.transfers
language plpgsql security definer set search_path = '' as $$
declare
  v_sale public.sales; v_row public.transfers; v_buyer jsonb;
  v_shares numeric; v_primary int; v_on date; v_reason text;
begin
  select * into v_sale from public.sales where id = (p->>'sale_id')::uuid and deleted_at is null
  for update;
  if v_sale.id is null then
    raise exception 'Sale not found' using errcode = '42501';
  end if;
  if not private.has_role('super_admin','manager') then
    raise exception 'Only a Manager can approve a transfer' using errcode = '42501';
  end if;
  if not private.can_access_project(v_sale.project_id) then
    raise exception 'Not permitted' using errcode = '42501';
  end if;
  if v_sale.status not in ('booked','active') then
    raise exception 'This sale is % and cannot be transferred', v_sale.status;
  end if;

  v_reason := nullif(trim(p->>'reason'), '');
  if v_reason is null or length(v_reason) < 3 then
    raise exception 'Give the reason for the transfer';
  end if;
  v_on := coalesce(nullif(p->>'transfer_date','')::date, private.today_pk());
  perform set_config('app.reason', left(v_reason, 500), true);

  select coalesce(sum((b->>'share_pct')::numeric), 0),
         count(*) filter (where coalesce((b->>'is_primary')::boolean, false))
    into v_shares, v_primary
  from jsonb_array_elements(coalesce(p->'buyers', '[]'::jsonb)) b;
  if v_shares <> 100 then
    raise exception 'Buyer shares must add up to 100%% (they add up to %%%)', v_shares;
  end if;
  if v_primary <> 1 then
    raise exception 'Mark exactly one buyer as the primary buyer';
  end if;

  insert into public.transfers (sale_id, project_id, unit_id, transfer_no, transfer_date,
                                transfer_fee, reason, notes, created_by)
  values (v_sale.id, v_sale.project_id, v_sale.unit_id,
          public.next_doc_no(v_sale.project_id, 'TRF'), v_on,
          coalesce(nullif(p->>'transfer_fee','')::numeric, 0), v_reason,
          nullif(p->>'notes',''), auth.uid())
  returning * into v_row;

  -- close the outgoing owners' slices, then open the incoming ones
  update public.unit_ownerships set valid_to = v_on
  where sale_id = v_sale.id and valid_to is null;

  delete from public.sale_buyers where sale_id = v_sale.id;

  for v_buyer in select * from jsonb_array_elements(p->'buyers') loop
    insert into public.sale_buyers (sale_id, client_id, share_pct, is_primary)
    values (v_sale.id, (v_buyer->>'client_id')::uuid, (v_buyer->>'share_pct')::numeric,
            coalesce((v_buyer->>'is_primary')::boolean, false));

    insert into public.unit_ownerships (unit_id, sale_id, client_id, share_pct, valid_from,
                                        acquired_via, transfer_id, created_by)
    values (v_sale.unit_id, v_sale.id, (v_buyer->>'client_id')::uuid,
            (v_buyer->>'share_pct')::numeric, v_on, 'transfer', v_row.id, auth.uid());
  end loop;

  perform private.refresh_sale(v_sale.id);
  return v_row;
end $$;
revoke execute on function public.transfer_sale(jsonb) from anon, public;
grant execute on function public.transfer_sale(jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Cancellation. A Manager confirms it; nothing cancels itself.
-- The deduction is a percentage of the TOTAL SALE PRICE, not of what was received, and the
-- figures are frozen on the row so later activity cannot silently restate the refund.
-- ---------------------------------------------------------------------------
create or replace function public.cancel_sale(p jsonb)
returns public.cancellations
language plpgsql security definer set search_path = '' as $$
declare
  v_sale public.sales; v_proj public.projects; v_row public.cancellations;
  v_received numeric(14,2); v_pct numeric(5,2); v_ded numeric(14,2); v_refund numeric(14,2);
  v_on date; v_reason text;
begin
  select * into v_sale from public.sales where id = (p->>'sale_id')::uuid and deleted_at is null
  for update;
  if v_sale.id is null then
    raise exception 'Sale not found' using errcode = '42501';
  end if;
  if not private.has_role('super_admin','manager') then
    raise exception 'Only a Manager can cancel a booking' using errcode = '42501';
  end if;
  if not private.can_access_project(v_sale.project_id) then
    raise exception 'Not permitted' using errcode = '42501';
  end if;
  if v_sale.status not in ('booked','active') then
    raise exception 'This sale is % and cannot be cancelled', v_sale.status;
  end if;

  v_reason := nullif(trim(p->>'reason'), '');
  if v_reason is null or length(v_reason) < 3 then
    raise exception 'Give the reason for cancelling';
  end if;
  v_on := coalesce(nullif(p->>'cancelled_on','')::date, private.today_pk());
  perform set_config('app.reason', left(v_reason, 500), true);

  select * into v_proj from public.projects where id = v_sale.project_id;

  -- only money that actually cleared counts towards a refund
  select coalesce(sum(amount), 0) into v_received
  from public.payments
  where sale_id = v_sale.id and private.payment_is_cleared(status, instrument_status);

  v_pct := coalesce(nullif(p->>'deduction_pct','')::numeric, v_proj.cancellation_deduction_pct, 0);
  v_ded := round(v_sale.final_price * v_pct / 100, 2);
  -- if the deduction exceeds what was received, the Seller simply keeps what it has
  v_refund := greatest(round(v_received - v_ded, 2), 0);

  insert into public.cancellations (sale_id, project_id, unit_id, cancellation_no, cancelled_on,
    reason, amount_received, sale_price, deduction_pct, deduction_amount, refund_due, created_by)
  values (v_sale.id, v_sale.project_id, v_sale.unit_id,
          public.next_doc_no(v_sale.project_id, 'CAN'), v_on, v_reason,
          v_received, v_sale.final_price, v_pct, v_ded, v_refund, auth.uid())
  returning * into v_row;

  update public.sales set status = 'cancelled', cancellation_due = false where id = v_sale.id;
  update public.unit_ownerships set valid_to = v_on
  where sale_id = v_sale.id and valid_to is null;

  -- frees the unit (refresh_unit_status keeps a manual hold or block)
  perform private.refresh_sale(v_sale.id);
  return v_row;
end $$;
revoke execute on function public.cancel_sale(jsonb) from anon, public;
grant execute on function public.cancel_sale(jsonb) to authenticated;

-- "the balance is refunded after re-selling the plot, within N days of that re-sale."
-- Booking a cancelled plot to someone else is what starts that clock.
create or replace function private.link_pending_refund() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_days smallint;
begin
  select s.refund_days_after_resale into v_days
  from public.project_document_settings s where s.project_id = new.project_id;

  update public.cancellations c set
    resold_sale_id  = new.id,
    refund_due_date = new.booking_date + coalesce(v_days, 0),
    refund_status   = 'payable'
  where c.unit_id = new.unit_id
    and c.refund_status = 'pending_resale';
  return null;
end $$;
create trigger sales_link_pending_refund after insert on public.sales
  for each row execute function private.link_pending_refund();

-- Paying the refund out. Accounts or a Manager; the reference is the bank/cheque detail.
create or replace function public.settle_refund(p_cancellation uuid, p_paid_on date,
                                                p_reference text, p_reason text)
returns public.cancellations
language plpgsql security definer set search_path = '' as $$
declare v_row public.cancellations;
begin
  select * into v_row from public.cancellations where id = p_cancellation for update;
  if v_row.id is null or not private.can_handle_money(v_row.project_id) then
    raise exception 'Not permitted' using errcode = '42501';
  end if;
  if v_row.refund_status = 'paid' then
    raise exception 'That refund is already paid';
  end if;
  if v_row.refund_status = 'waived' then
    raise exception 'That refund was waived';
  end if;
  -- Normally the refund waits for the re-sale. A Manager may release it early, with a reason.
  if v_row.refund_status = 'pending_resale' and not private.has_role('super_admin','manager') then
    raise exception 'This refund is not payable until the plot is re-sold' using errcode = '42501';
  end if;
  if p_reason is null or length(trim(p_reason)) < 3 then
    raise exception 'Give a reason or reference for the refund';
  end if;
  perform set_config('app.reason', left(trim(p_reason), 500), true);

  update public.cancellations set
    refund_status    = 'paid',
    refunded_on      = coalesce(p_paid_on, private.today_pk()),
    refund_reference = nullif(trim(p_reference), '')
  where id = p_cancellation
  returning * into v_row;
  return v_row;
end $$;
revoke execute on function public.settle_refund(uuid, date, text, text) from anon, public;
grant execute on function public.settle_refund(uuid, date, text, text) to authenticated;

grant execute on all functions in schema private to authenticated, service_role;
