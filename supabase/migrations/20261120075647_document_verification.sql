create table public.issued_documents (
  id uuid primary key default gen_random_uuid(),
  token text unique not null default encode(extensions.gen_random_bytes(16), 'hex'),
  doc_type text not null,
  ref_no text not null,
  sale_id uuid references public.sales(id),
  payment_id uuid references public.payments(id),
  project_id uuid not null references public.projects(id),
  issued_at timestamptz not null default now(),
  issued_by uuid references public.profiles(id),
  revoked_at timestamptz,
  revoked_reason text,
  buyer_display_name text,
  unique (doc_type, ref_no)
);

create index issued_documents_project_idx on public.issued_documents (project_id);
alter table public.issued_documents enable row level security;
revoke all on public.issued_documents from public, anon, authenticated;
grant select on public.issued_documents to authenticated;

create policy issued_documents_select on public.issued_documents for select to authenticated
  using ((select private.is_staff()) and (select private.can_access_project(project_id))
         and (select private.can_see_sale(sale_id)));

-- TODO(owner): add a super-admin action to revoke issued documents.
create function public.issue_document(p jsonb) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_sale public.sales;
  v_payment public.payments;
  v_type text := p->>'doc_type';
  v_ref text;
  v_prefix text;
  v_token text;
  v_buyer text[];
begin
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
  select regexp_split_to_array(trim(c.full_name), '\s+') into v_buyer
  from public.sale_buyers b join public.clients c on c.id = b.client_id
  where b.sale_id = v_sale.id and b.is_primary;

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
revoke execute on function public.issue_document(jsonb) from public, anon, authenticated;
grant execute on function public.issue_document(jsonb) to authenticated;

create function public.verify_document(p_token text) returns jsonb
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
      when 'statement_of_account' then 'Statement of Account'
    end,
    'ref_no', d.ref_no,
    'issued_on', (d.issued_at at time zone 'Asia/Karachi')::date,
    'project_name', j.name,
    'plot_no', u.unit_no,
    'buyer_name', d.buyer_display_name,
    'status', case
      when d.revoked_at is not null or s.deleted_at is not null then 'revoked'
      when p.status = 'reversed' then 'reversed'
      when p.instrument_status = 'bounced' then 'bounced'
      when s.status = 'cancelled' then 'cancelled'
      when exists (
        select 1 from public.transfers t
        where t.unit_id = s.unit_id and t.created_at > d.issued_at
      ) then 'superseded'
      else 'valid'
    end
  ) || case when d.doc_type = 'payment_receipt'
    then jsonb_build_object('amount', p.amount::text)
    else '{}'::jsonb
  end
  from public.issued_documents d
  join public.projects j on j.id = d.project_id
  left join public.sales s on s.id = d.sale_id
  left join public.units u on u.id = s.unit_id
  left join public.payments p on p.id = d.payment_id
  where d.token = p_token;
$$;
revoke execute on function public.verify_document(text) from public, anon, authenticated;
grant execute on function public.verify_document(text) to anon, authenticated;
