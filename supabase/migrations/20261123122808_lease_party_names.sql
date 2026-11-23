-- An assigned agent can see the parties named on a lease under the lease policy.
-- Keep client contact and identity fields governed by the existing client policy.
create view public.v_lease_party_names with (security_barrier = true) as
select l.id as lease_id, tenant.full_name as tenant_name, landlord.full_name as landlord_name
from public.leases l
join public.clients tenant on tenant.id = l.tenant_client_id
left join public.clients landlord on landlord.id = l.landlord_client_id
where private.can_see_lease(l.id);

revoke all on public.v_lease_party_names from anon, authenticated;
grant select on public.v_lease_party_names to authenticated;
