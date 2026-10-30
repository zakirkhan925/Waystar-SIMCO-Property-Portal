-- The recoveries screen names the project in its reminder text, so expose it on the view.
drop view if exists public.v_receivables;
create view public.v_receivables with (security_invoker = true) as
select
  i.id as installment_id, i.sale_id, s.project_id, p.name as project_name, p.code as project_code,
  s.unit_id, u.unit_no, i.seq, i.label, i.type,
  i.due_date, i.days_overdue, i.status,
  (i.amount_due + i.late_fee - i.amount_paid - i.waived_amount)::numeric(14,2) as outstanding,
  i.amount_pending,
  case
    when i.days_overdue = 0  then 'not_due'
    when i.days_overdue <= 30 then '0_30'
    when i.days_overdue <= 60 then '31_60'
    when i.days_overdue <= 90 then '61_90'
    else '90_plus'
  end as aging_bucket,
  c.id as client_id, c.full_name as client_name, c.phone as client_phone, c.whatsapp as client_whatsapp
from public.installments i
join public.sales s on s.id = i.sale_id and s.deleted_at is null
join public.projects p on p.id = s.project_id
join public.units u on u.id = s.unit_id
left join public.sale_buyers b on b.sale_id = s.id and b.is_primary
left join public.clients c on c.id = b.client_id
where i.deleted_at is null
  and i.status in ('pending','partially_paid','overdue')
  and s.status in ('booked','active');

grant select on public.v_receivables to authenticated;
revoke all on public.v_receivables from anon;
