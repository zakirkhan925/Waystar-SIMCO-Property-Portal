-- =============================================================================
-- PRODUCTION seed — real inventory only.
--
-- Unlike supabase/seed.sql (local development), this file creates NO users, NO
-- shared passwords, NO fictitious clients, dealers, bookings or payments. It
-- seeds only the things that are facts about the business:
--
--   * company settings
--   * the 5 SIMCO projects
--   * Simco Villas sales policy, letter settings and document templates
--   * blocks / towers / floors / units (the inventory)
--   * payment plans
--
-- Everything it creates is attributed to the real Super Admin, so the audit log
-- and every created_by column name a real person rather than nobody.
--
-- Simco Villas carries SIMCO's real plan and real prices (31-Oct-2026).
--
-- >>> THE FOUR HIGH-RISE PRICE LISTS ARE STILL PLACEHOLDERS <<<
-- base_price is NOT NULL, so every unit must carry a figure. The high-rise rates
-- below are the sample rates from local development. They are NOT SIMCO's price
-- list. Replace them before anyone quotes a buyer — see "Updating prices" at the
-- foot of this file. The high-rise layouts are likewise invented, pending each
-- building's own approved plan.
--
-- Run once:  psql "$DATABASE_URL" -f supabase/seed-production.sql
-- (or paste into the Supabase SQL editor). It runs as a single transaction, so
-- it either seeds everything or changes nothing.
-- =============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 0. Safety: refuse to run twice, and refuse to run without a real Super Admin.
-- ---------------------------------------------------------------------------
do $$
declare
  v_admin uuid;
  v_email text := 'zakir.khan@simcodevelopers.com';   -- the real Super Admin
begin
  if exists (select 1 from public.projects) then
    raise exception
      'This database already has projects. seed-production.sql is a one-time seed and will not run again.';
  end if;

  select u.id into v_admin from auth.users u where lower(u.email) = lower(v_email);
  if v_admin is null then
    raise exception 'Super Admin % does not exist yet. Create that account before seeding.', v_email;
  end if;
  if not exists (select 1 from public.profiles p where p.id = v_admin and p.role = 'super_admin') then
    raise exception 'User % exists but is not a super_admin.', v_email;
  end if;

  -- Attribute everything below to the Super Admin: the force_created_by trigger
  -- and the audit log both read auth.uid().
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin)::text, false);
  perform set_config('app.reason', 'Initial production inventory seed', false);
end $$;

-- ---------------------------------------------------------------------------
-- 1. Company settings
--    Phone is deliberately left alone: a placeholder would print onto letters.
-- ---------------------------------------------------------------------------
update public.company_settings set
  address = 'Islamabad / Rawalpindi, Pakistan',
  email   = 'info@waystarmarketing.com';

-- ---------------------------------------------------------------------------
-- 2. Projects
-- ---------------------------------------------------------------------------
insert into public.projects (id, name, code, type, status, location, description, sort_order,
                             late_fee_method, late_fee_rate, late_fee_grace_days) values
  ('10000000-0000-4000-a000-000000000001','Simco Villas','SV','plot_society','under_construction',
   'PMO Road, Taxila','Residential society — 5, 6 and 8 Marla plots.',1,'pct_of_overdue_per_month',10,0),
  ('10000000-0000-4000-a000-000000000002','Simco Square','SSQ','high_rise','under_construction',
   'Islamabad','Mixed-use high-rise: shops, offices and apartments.',2,'none',0,0),
  ('10000000-0000-4000-a000-000000000003','The Vintage','VIN','high_rise','off_plan',
   'Islamabad','Mixed-use high-rise: shops, offices and apartments.',3,'none',0,0),
  ('10000000-0000-4000-a000-000000000004','Simco Residencia','RES','high_rise','under_construction',
   'Rawalpindi','Mixed-use high-rise: shops, offices and apartments.',4,'none',0,0),
  ('10000000-0000-4000-a000-000000000005','The Meridian','MER','high_rise','completed',
   'Islamabad','Mixed-use high-rise: shops, offices and apartments.',5,'none',0,0);

-- No user_project_access rows: private.can_access_project() already grants
-- Super Admins and Managers every project. Agents, Accounts and Viewers are
-- granted projects individually as they are onboarded.

-- ---------------------------------------------------------------------------
-- 3. Simco Villas: the policy SIMCO confirmed (docs/02-business-rules.md)
-- ---------------------------------------------------------------------------
update public.projects set
  corner_premium_pct = 10,
  cancel_after_consecutive_missed = 2,
  cancellation_deduction_pct = 20,
  construction_min_paid_pct = 80,
  full_payment_possession_charge_pct = 5,
  full_payment_discount_pct = 5,
  down_payment_balance_days = 0     -- the balance of the down payment is due at once
where code = 'SV';

insert into public.project_document_settings (project_id, display_name, full_address, execution_city,
  seller_legal_name, seller_office_address, seller_account_title, marketed_by)
values ('10000000-0000-4000-a000-000000000001', 'SIMCO VILLAS', 'PMO Road, Taxila, District Rawalpindi', 'Taxila',
  'SIMCO DEVELOPERS', 'Simco Square, Faisal Hills, Taxila, District Rawalpindi', 'SIMCO DEVELOPERS', 'Waystar Royco');

select public.install_document_templates('10000000-0000-4000-a000-000000000001', 'plot_society_simco');

-- ---------------------------------------------------------------------------
-- 4. Simco Villas — taken from the approved master plan.
--
--    The scheme has NO blocks: plots are numbered 01-121 across the whole site,
--    which is how the documents refer to them ("Plot No. {{plot_no}}").
--    Plot 122 is the 4,410 sqft commercial plot, which the plan leaves unnumbered.
--
--      25' x 50' (5 Marla)  83 plots  1-23, 27-33, 36-39, 57, 71-118
--      30' x 50' (6 Marla)  24 plots  40-56, 62-68
--      30' x 60' (8 Marla)   4 plots  60, 61, 69, 70
--      Irregular             7 plots  24, 25, 26, 34, 35, 58, 59
--      Commercial 50' x 50'  3 plots  119, 120, 121   (2,500 sqft each)
--      Commercial            1 plot   122             (4,410 sqft)
--
--    83 + 24 + 4 + 7 = 118 residential, matching the plan's own legend.
--
--    Prices are SIMCO's list of 31-Oct-2026. base_price is the installment price;
--    cash_price is the Full Payment price.
--
--    The 7 irregular plots and the 4 commercial plots are created BLOCKED: their
--    area and/or price are not yet confirmed, and a blocked unit cannot be booked.
--    Unblock each one as its real figures are loaded.
--
--    Corner plots are read off the plan as those with TWO road frontages. Each of the
--    five rectangular blocks is ringed by roads, with a top row, two back-to-back middle
--    columns and a bottom row; only the four extreme plots of each block turn a corner.
--    The middle-column plots have a single frontage and are not corners.
--
--      01, 04, 71, 74 | 05, 08, 75, 78 | 09, 12, 79, 82 | 24, 26, 20, 17 | 34, 35, 16, 13
--
--    Corner plots carry +10% on BOTH published prices (client, 31-Oct-2026): on the
--    installment list price, and on the cash price, which is the after-discount figure.
--    All 20 corners fall in the 25'x50' blocks, so only 5 Marla plots are uplifted:
--      5 Marla corner  installment 3,740,000  cash 3,289,000
--    No 6 or 8 Marla plot is a corner — every one of them sits in a perimeter strip whose
--    second boundary is the boundary wall rather than a road. Plots 40, 60 and 70 are the
--    open question there; if SIMCO treats them as corners, uplift them too.
-- ---------------------------------------------------------------------------
do $$
declare
  v_p uuid := '10000000-0000-4000-a000-000000000001';
  n int;
  v_use public.unit_use;
  v_sv numeric; v_su public.size_unit; v_w numeric; v_d numeric;
  v_base numeric; v_cash numeric; v_status public.unit_status; v_note text; v_no text;
  v_corner boolean;
begin
  for n in 1..122 loop
    v_use := 'residential'; v_note := null;
    v_status := 'available'; v_w := null; v_d := null; v_cash := null;
    v_corner := n in (1,4,71,74, 5,8,75,78, 9,12,79,82, 24,26,20,17, 34,35,16,13);
    -- the plan prints 01..09 zero-padded; lpad() would TRUNCATE 100+, so build it by hand
    v_no := case when n < 10 then '0' || n::text else n::text end;

    if n in (119,120,121) then
      v_use := 'commercial'; v_sv := 2500; v_su := 'sqft'; v_w := 50; v_d := 50;
      v_base := 0; v_status := 'blocked';
      v_note := 'Commercial plot 50ft x 50ft (2,500 sqft). Price not yet set — blocked until then.';
    elsif n = 122 then
      v_use := 'commercial'; v_sv := 4410; v_su := 'sqft';
      v_base := 0; v_status := 'blocked';
      v_note := 'Commercial plot, 4,410 sqft (unnumbered on the master plan; given no. 122). Price not yet set — blocked until then.';
    elsif n in (24,25,26,34,35,58,59) then
      v_sv := 1250; v_su := 'sqft';
      v_base := 0; v_status := 'blocked';
      v_note := 'IRREGULAR plot. Area 1,250 sqft is a PLACEHOLDER and price is not set — blocked until both are confirmed from the approved layout.';
    elsif (n between 40 and 56) or (n between 62 and 68) then
      v_sv := 6; v_su := 'marla'; v_w := 30; v_d := 50;
      v_base := 3800000; v_cash := 3390000;
    elsif n in (60,61,69,70) then
      v_sv := 8; v_su := 'marla'; v_w := 30; v_d := 60;
      v_base := 4800000; v_cash := 4490000;
    else
      v_sv := 5; v_su := 'marla'; v_w := 25; v_d := 50;
      v_base := 3400000; v_cash := 2990000;
    end if;

    -- Corner premium (31-Oct-2026): +10% on the installment price, and +10% on the cash
    -- price, which is applied to the after-discount figure SIMCO publishes.
    if v_corner and v_base > 0 then
      v_base := round(v_base * 1.10, 2);
      v_cash := round(v_cash * 1.10, 2);
    end if;

    insert into public.units (project_id, unit_no, category, use, size_value, size_unit,
                              width_ft, depth_ft, base_price, cash_price, status, notes, is_corner)
    values (v_p, v_no, 'plot', v_use, v_sv, v_su, v_w, v_d, v_base, v_cash, v_status, v_note, v_corner);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 5. High-rises — 1 tower each. Basement/Ground/Mezzanine shops, 1st-2nd
--    offices, middle floors apartments, top floor penthouses.
--    Every unit starts AVAILABLE.
-- ---------------------------------------------------------------------------
do $$
declare
  p record; v_tower uuid; v_floor uuid;
  lvl int; n int; i int := 0;
  v_label text; v_cat public.unit_category; v_use public.unit_use;
  v_size numeric; v_rate numeric; v_beds smallint; v_per_floor int; v_unit_no text;
begin
  for p in select id, code, (case code when 'SSQ' then 12 when 'VIN' then 10 when 'RES' then 14 else 16 end) as top_floor,
                  (case code when 'SSQ' then 1.00 when 'VIN' then 0.95 when 'RES' then 0.90 else 1.10 end) as k
           from public.projects where type = 'high_rise'
  loop
    insert into public.blocks (project_id, name, kind, sort_order)
    values (p.id, 'Tower A', 'tower', 1) returning id into v_tower;

    for lvl in -1..p.top_floor loop
      v_label := case
                   when lvl = -1 then 'Basement'
                   when lvl = 0  then 'Ground'
                   when lvl = 1  then 'Mezzanine'
                   else (lvl - 1)::text || case when (lvl - 1) % 10 = 1 and (lvl - 1) <> 11 then 'st'
                                                when (lvl - 1) % 10 = 2 and (lvl - 1) <> 12 then 'nd'
                                                when (lvl - 1) % 10 = 3 and (lvl - 1) <> 13 then 'rd'
                                                else 'th' end
                 end;
      insert into public.floors (block_id, label, level, sort_order)
      values (v_tower, v_label, lvl, lvl + 10) returning id into v_floor;

      v_per_floor := case when lvl <= 1 then 8 when lvl <= 3 then 6
                          when lvl = p.top_floor then 2 else 4 end;
      for n in 1..v_per_floor loop
        i := i + 1;
        if lvl <= 1 then
          v_cat := 'shop'; v_use := 'commercial'; v_beds := null;
          v_size := (array[280, 350, 420, 520, 650])[1 + i % 5];
          v_rate := case lvl when -1 then 32000 when 0 then 48000 else 38000 end;   -- PLACEHOLDER
        elsif lvl <= 3 then
          v_cat := 'office'; v_use := 'commercial'; v_beds := null;
          v_size := (array[480, 620, 780, 950])[1 + i % 4];
          v_rate := 24000;                                                           -- PLACEHOLDER
        elsif lvl = p.top_floor then
          v_cat := 'penthouse'; v_use := 'residential'; v_beds := 4;
          v_size := (array[3200, 3600])[1 + i % 2];
          v_rate := 26000;                                                           -- PLACEHOLDER
        else
          v_cat := 'apartment'; v_use := 'residential';
          v_beds := (array[1, 2, 2, 3])[1 + n % 4];
          v_size := case v_beds when 1 then 720 when 2 then 1150 else 1650 end;
          v_rate := 18500 + (lvl * 150);                                             -- PLACEHOLDER
        end if;

        v_unit_no := case when lvl = -1 then 'B-' || lpad(n::text, 2, '0')
                          when lvl = 0  then 'G-' || lpad(n::text, 2, '0')
                          when lvl = 1  then 'M-' || lpad(n::text, 2, '0')
                          else (lvl - 1)::text || lpad(n::text, 2, '0') end;

        insert into public.units (project_id, block_id, floor_id, unit_no, category, use,
                                  size_value, size_unit, bedrooms, bathrooms, base_price,
                                  price_per_sqft, is_corner, status)
        values (p.id, v_tower, v_floor, v_unit_no, v_cat, v_use, v_size, 'sqft', v_beds,
                case when v_beds is null then null else v_beds end,
                round(v_size * v_rate * p.k, -3), round(v_rate * p.k, 0), n in (1, v_per_floor),
                'available');
      end loop;
    end loop;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 6. Payment plans
--    Simco Villas follows SIMCO's own plan: 30% down, then 70% in 8 quarterly
--    installments. The unscoped plans are available to every project.
-- ---------------------------------------------------------------------------
insert into public.payment_plans (project_id, name, kind, down_payment_pct, installment_pct, possession_pct,
                                  tenure_months, frequency, is_default)
values
  ('10000000-0000-4000-a000-000000000001','SIMCO Villas — 30% + 8 quarterly','installment',30,70,0,24,'quarterly',true),
  ('10000000-0000-4000-a000-000000000001','SIMCO Villas — Full Payment','full_cash',100,0,0,null,null,false),
  (null,'Standard — 40/50/10, 24 months quarterly','installment',40,50,10,24,'quarterly',true),
  (null,'Standard — 40/50/10, 12 months monthly','installment',40,50,10,12,'monthly',false),
  (null,'Full Payment','full_cash',100,0,0,null,null,false);

-- ---------------------------------------------------------------------------
-- 7. Done — drop the impersonation.
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '', false),
       set_config('app.reason', '', false);

commit;

select p.code, p.name, count(u.id) as units, min(u.base_price) as cheapest, max(u.base_price) as dearest
from public.projects p left join public.units u on u.project_id = p.id
group by p.code, p.name, p.sort_order order by p.sort_order;

-- =============================================================================
-- Updating prices
--
-- Every base_price above is a placeholder. To load the real price list, use the
-- update_unit() RPC so the change is audited and price_per_sqft is recomputed:
--
--   select public.update_unit(
--            (select id from public.units u join public.projects p on p.id = u.project_id
--              where p.code = 'SV' and u.unit_no = '101'),
--            jsonb_build_object('base_price', 9750000),
--            'Loaded from the SIMCO price list of <date>');
--
-- Setting base_price alone leaves the old price_per_sqft in place; pass
-- 'price_per_sqft', null alongside it to have the trigger recompute it.
--
-- Corner pricing
--
-- The Booking Form and the Allotment Letter both say "Corner plots carry an additional
-- 10% on the plot price", and projects.corner_premium_pct is 10. Nothing applies that
-- automatically — create_sale() takes whatever list_price the caller passes, which defaults
-- to the unit's own price — so the premium is baked into base_price / cash_price above.
-- =============================================================================
