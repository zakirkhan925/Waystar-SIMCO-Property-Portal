alter table public.issued_documents
  add column lease_id uuid references public.leases(id),
  add column rent_invoice_id uuid references public.rent_invoices(id),
  add column rent_payment_id uuid references public.rent_payments(id),
  add constraint issued_documents_rental_source check (
    case when doc_type in ('rent_receipt', 'rent_invoice', 'lease_agreement')
      then lease_id is not null and sale_id is null and payment_id is null
        and (rent_invoice_id is not null) = (doc_type = 'rent_invoice')
        and (rent_payment_id is not null) = (doc_type = 'rent_receipt')
      else lease_id is null and rent_invoice_id is null and rent_payment_id is null
    end
  );
create index issued_documents_lease_idx on public.issued_documents (lease_id) where lease_id is not null;

alter policy issued_documents_select on public.issued_documents
  using ((select private.is_staff()) and (select private.can_access_project(project_id))
    and case when lease_id is not null then (select private.can_see_lease(lease_id))
             else (select private.can_see_sale(sale_id)) end);

create function private.issue_rental_document(p jsonb) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_lease public.leases;
  v_invoice public.rent_invoices;
  v_payment public.rent_payments;
  v_type public.document_type := (p->>'doc_type')::public.document_type;
  v_ref text;
  v_tenant text[];
  v_token text;
begin
  select * into v_lease from public.leases l
  where l.id = (p->>'lease_id')::uuid and l.project_id = (p->>'project_id')::uuid
    and private.can_see_lease(l.id)
  for share;
  if v_lease.id is null or auth.uid() is null then
    raise exception 'Not permitted to issue this document' using errcode = '42501';
  end if;

  case v_type
    when 'rent_receipt' then
      select * into v_payment from public.rent_payments
      where id = (p->>'rent_payment_id')::uuid and lease_id = v_lease.id;
      v_ref := v_payment.receipt_no;
    when 'rent_invoice' then
      select * into v_invoice from public.rent_invoices
      where id = (p->>'rent_invoice_id')::uuid and lease_id = v_lease.id;
      v_ref := v_invoice.invoice_no;
    when 'lease_agreement' then
      v_ref := v_lease.agreement_no;
    else
      raise exception 'Unknown rental document type' using errcode = '22023';
  end case;

  if v_ref is null or v_ref is distinct from p->>'ref_no' then
    raise exception 'Invalid document reference' using errcode = '22023';
  end if;

  select regexp_split_to_array(trim(full_name), '\s+') into v_tenant
  from public.clients where id = v_lease.tenant_client_id;

  insert into public.issued_documents as d (
    doc_type, ref_no, project_id, lease_id, rent_invoice_id, rent_payment_id, issued_by, issued_at, buyer_display_name)
  values (v_type::text, v_ref, v_lease.project_id, v_lease.id, v_invoice.id, v_payment.id, auth.uid(), clock_timestamp(),
    case when cardinality(v_tenant) > 1 then v_tenant[1] || ' ' || left(v_tenant[cardinality(v_tenant)], 1) || '.'
         else v_tenant[1] end)
  on conflict (doc_type, ref_no) do update set ref_no = excluded.ref_no
    where d.project_id = excluded.project_id and d.lease_id = excluded.lease_id
      and d.rent_invoice_id is not distinct from excluded.rent_invoice_id
      and d.rent_payment_id is not distinct from excluded.rent_payment_id
  returning token into v_token;

  if v_token is null then raise exception 'Document reference already in use' using errcode = '23505'; end if;
  return v_token;
end $$;
revoke execute on function private.issue_rental_document(jsonb) from public, anon, authenticated;

create or replace function public.issue_document(p jsonb) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_sale public.sales;
  v_payment public.payments;
  v_transfer public.transfers;
  v_type text := p->>'doc_type';
  v_ref text;
  v_prefix text;
  v_token text;
  v_buyer text[];
begin
  if v_type in ('rent_receipt', 'rent_invoice', 'lease_agreement') then
    return private.issue_rental_document(p);
  end if;

  select s.* into v_sale from public.sales s
  where s.id = (p->>'sale_id')::uuid and s.deleted_at is null
    and s.project_id = (p->>'project_id')::uuid
    and private.can_see_sale(s.id)
  for share;

  if v_sale.id is null or auth.uid() is null or not private.is_staff() then
    raise exception 'Not permitted to issue this document' using errcode = '42501';
  end if;

  if v_type = 'payment_receipt' then
    select * into v_payment from public.payments
    where id = (p->>'payment_id')::uuid and sale_id = v_sale.id and project_id = v_sale.project_id;
    v_ref := v_payment.receipt_no;
  elsif v_type = 'transfer_letter' then
    select * into v_transfer from public.transfers
    where id = (p->>'transfer_id')::uuid and sale_id = v_sale.id and project_id = v_sale.project_id;
    v_ref := v_transfer.transfer_no;
  elsif v_type = 'cancellation_letter' then
    if v_sale.status = 'cancelled'
      and private.has_role('super_admin','manager','accounts','viewer')
      and exists (
        select 1 from public.cancellations c
        where c.id = (p->>'cancellation_id')::uuid and c.sale_id = v_sale.id
          and c.project_id = v_sale.project_id
      ) then
      v_prefix := 'CNL';
    end if;
  elsif v_type = 'statement_of_account' then
    v_prefix := 'SOA';
  elsif v_type in ('booking_form', 'allotment_letter', 'sale_agreement', 'installment_schedule',
                   'possession_letter', 'ndc_letter') and v_sale.status <> 'cancelled' then
    if v_type = 'possession_letter' and not exists (
      select 1 from public.possessions where sale_id = v_sale.id and deleted_at is null
    ) then
      raise exception 'Possession has not been handed over';
    end if;
    if v_type = 'ndc_letter' and (
      select coalesce(sum(amount_due + late_fee - amount_paid - waived_amount - late_fee_paid), 0)
      from public.installments where sale_id = v_sale.id and deleted_at is null
    ) > 0 then
      raise exception 'The sale has outstanding dues';
    end if;

    select t.ref_prefix into v_prefix from public.document_templates t
    where t.doc_type::text = v_type and t.is_active
      and (t.project_id = v_sale.project_id or t.project_id is null)
    order by (t.project_id is not null) desc limit 1;
    if v_type = 'booking_form' and v_prefix is not null then
      v_ref := v_sale.booking_form_no;
      v_prefix := null;
    end if;
  end if;

  if v_prefix is not null then
    v_ref := case when strpos(v_sale.booking_form_no, '-BF-') > 0
      then overlay(v_sale.booking_form_no placing '-' || v_prefix || '-'
                   from strpos(v_sale.booking_form_no, '-BF-') for 4)
      else v_prefix || '-' || v_sale.booking_form_no
    end;
  end if;
  if v_ref is null or v_ref is distinct from p->>'ref_no' then
    raise exception 'Invalid document reference' using errcode = '22023';
  end if;

  -- Keep the original buyer's masked name even if a later transfer changes the buyer.
  if v_type = 'transfer_letter' then
    select regexp_split_to_array(trim(c.full_name), '\s+') into v_buyer
    from public.unit_ownerships o join public.clients c on c.id = o.client_id
    where o.transfer_id = v_transfer.id
    order by o.share_pct desc, o.client_id limit 1;
  else
    select regexp_split_to_array(trim(c.full_name), '\s+') into v_buyer
    from public.sale_buyers b join public.clients c on c.id = b.client_id
    where b.sale_id = v_sale.id and b.is_primary;
  end if;

  insert into public.issued_documents as d
    (doc_type, ref_no, sale_id, payment_id, project_id, issued_by, issued_at, buyer_display_name)
  values (v_type, v_ref, v_sale.id, v_payment.id, v_sale.project_id, auth.uid(), clock_timestamp(),
          case when cardinality(v_buyer) > 1
            then v_buyer[1] || ' ' || left(v_buyer[cardinality(v_buyer)], 1) || '.'
            else v_buyer[1]
          end)
  on conflict (doc_type, ref_no) do update set ref_no = excluded.ref_no
    where d.sale_id = excluded.sale_id and d.project_id = excluded.project_id
      and d.payment_id is not distinct from excluded.payment_id
  returning token into v_token;

  if v_token is null then
    raise exception 'Document reference already in use' using errcode = '23505';
  end if;
  return v_token;
end;
$$;

create or replace function public.verify_document(p_token text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'document_type', case d.doc_type
      when 'booking_form' then 'Booking Form'
      when 'allotment_letter' then 'Allotment Letter'
      when 'sale_agreement' then 'Sale Agreement'
      when 'installment_schedule' then 'Installment Payment Schedule'
      when 'possession_letter' then 'Possession Letter'
      when 'ndc_letter' then 'No Dues Certificate'
      when 'payment_receipt' then 'Payment Receipt'
      when 'transfer_letter' then 'Transfer Letter'
      when 'statement_of_account' then 'Statement of Account'
      when 'cancellation_letter' then 'Cancellation Letter'
      when 'rent_receipt' then 'Rent Receipt'
      when 'rent_invoice' then 'Rent Invoice'
      when 'lease_agreement' then 'Lease Summary'
    end,
    'ref_no', d.ref_no,
    'issued_on', (d.issued_at at time zone 'Asia/Karachi')::date,
    'project_name', j.name,
    'plot_no', u.unit_no,
    'buyer_name', case when d.lease_id is null then d.buyer_display_name end,
    'status', case
      when d.revoked_at is not null or s.deleted_at is not null then 'revoked'
      when p.status = 'reversed' or rp.status = 'reversed' then 'reversed'
      when p.instrument_status = 'bounced' or rp.instrument_status = 'bounced' then 'bounced'
      when d.doc_type = 'lease_agreement' and l.status = 'terminated' then 'terminated'
      when d.doc_type = 'lease_agreement' and l.status = 'renewed' then 'superseded'
      when d.doc_type = 'lease_agreement' and l.status = 'expired' then 'expired'
      when d.doc_type = 'cancellation_letter' and s.status = 'cancelled' then 'valid'
      when s.status = 'cancelled' then 'cancelled'
      when exists (
        select 1 from public.transfers t
        where t.unit_id = s.unit_id and (
          (d.doc_type = 'transfer_letter' and t.sale_id = s.id and t.transfer_no > d.ref_no)
          or (d.doc_type <> 'transfer_letter' and t.created_at > d.issued_at)
        )
      ) then 'superseded'
      else 'valid'
    end
  ) || case when d.lease_id is not null
    then jsonb_build_object('tenant_name', d.buyer_display_name)
    else '{}'::jsonb
  end || case when d.doc_type in ('payment_receipt', 'rent_receipt')
    then jsonb_build_object('amount', coalesce(p.amount, rp.amount)::text)
    else '{}'::jsonb
  end
  from public.issued_documents d
  join public.projects j on j.id = d.project_id
  left join public.sales s on s.id = d.sale_id
  left join public.leases l on l.id = d.lease_id
  left join public.units u on u.id = coalesce(s.unit_id, l.unit_id)
  left join public.rent_payments rp on rp.id = d.rent_payment_id
  left join public.payments p on p.id = d.payment_id
  where d.token = p_token;
$$;
