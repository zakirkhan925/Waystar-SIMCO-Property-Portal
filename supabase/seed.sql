-- =============================================================================
-- Local development seed. NEVER run against production.
-- Phase 1: users per role, 5 SIMCO projects with blocks/towers/floors/units, clients.
-- (Sales, installments and leases are added to this file in Phases 2 & 4.)
--
-- Local test logins (all share the password below — local dev only):
--   admin@waystar.test     super_admin
--   manager@waystar.test   manager
--   agent@waystar.test     sales_agent   (access: Simco Villas, Simco Square)
--   accounts@waystar.test  accounts      (access: all 5 projects)
--   viewer@waystar.test    viewer        (access: all 5 projects)
--   password: Waystar#Local2026
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Users (auth.users + identities; profiles are created by the trigger)
-- ---------------------------------------------------------------------------
do $$
declare
  u record;
begin
  for u in select * from (values
    ('00000000-0000-4000-a000-000000000001'::uuid, 'admin@waystar.test',    'Zakir Khan',     'super_admin'),
    ('00000000-0000-4000-a000-000000000002'::uuid, 'manager@waystar.test',  'Imran Qureshi',  'manager'),
    ('00000000-0000-4000-a000-000000000003'::uuid, 'agent@waystar.test',    'Bilal Ahmed',    'sales_agent'),
    ('00000000-0000-4000-a000-000000000004'::uuid, 'accounts@waystar.test', 'Sana Malik',     'accounts'),
    ('00000000-0000-4000-a000-000000000005'::uuid, 'viewer@waystar.test',   'SIMCO Management','viewer')
  ) as t(id, email, full_name, role)
  loop
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                            raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                            confirmation_token, recovery_token, email_change_token_new, email_change,
                            email_change_token_current, phone_change, phone_change_token, reauthentication_token)
    values ('00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
            extensions.crypt('Waystar#Local2026', extensions.gen_salt('bf')), now(),
            jsonb_build_object('provider','email','providers',array['email'],'role',u.role),
            jsonb_build_object('full_name', u.full_name), now(), now(),
            '', '', '', '', '', '', '', '');
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), u.id, u.id::text,
            jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
            'email', now(), now(), now());
  end loop;
end $$;

update public.company_settings set
  address = 'Islamabad / Rawalpindi, Pakistan',
  phone   = '+92 51 0000000',
  email   = 'info@waystarmarketing.com';

-- ---------------------------------------------------------------------------
-- Projects
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

insert into public.user_project_access (user_id, project_id)
select '00000000-0000-4000-a000-000000000003'::uuid, id from public.projects where code in ('SV','SSQ')
union all
select u.id, p.id from public.projects p
cross join (values ('00000000-0000-4000-a000-000000000004'::uuid),
                   ('00000000-0000-4000-a000-000000000005'::uuid)) as u(id);

-- ---------------------------------------------------------------------------
-- Simco Villas: policies + letter settings from SIMCO's documents, then plots.
-- Plot types per the Booking Form: 5 Marla (25' x 50'), 6 Marla (30' x 50'), 8 Marla (30' x 60').
-- Prices are SAMPLE figures only; corner plots carry +10%.
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

do $$
declare
  v_project uuid := '10000000-0000-4000-a000-000000000001';
  v_block uuid;
  b text; s int; n int; i int := 0;
  v_marla numeric; v_w numeric; v_d numeric; v_rate numeric; v_price numeric;
begin
  foreach b in array array['A','B','C'] loop
    insert into public.blocks (project_id, name, kind, sort_order)
    values (v_project, 'Block ' || b, 'block', ascii(b)) returning id into v_block;

    for s in 1..4 loop
      for n in 1..10 loop
        i := i + 1;
        -- plot types used by SIMCO: 5, 6 and 8 Marla, with their standard dimensions
        case (i % 3)
          when 0 then v_marla := 5; v_w := 25; v_d := 50; v_rate := 1500000;   -- sample price per marla
          when 1 then v_marla := 6; v_w := 30; v_d := 50; v_rate := 1450000;
          else        v_marla := 8; v_w := 30; v_d := 60; v_rate := 1400000;
        end case;
        v_price := v_marla * v_rate * case when n in (1,10) then 1.10 else 1 end;   -- corner +10%
        insert into public.units (project_id, block_id, street, unit_no, category, use,
                                  size_value, size_unit, width_ft, depth_ft, base_price,
                                  is_corner, is_park_facing, is_main_boulevard, status)
        values (v_project, v_block, 'Street ' || s, (s * 100 + n)::text, 'plot', 'residential',
                v_marla, 'marla', v_w, v_d, round(v_price, -3),
                n in (1,10), (s = 4 and n between 4 and 7), s = 1,
                case when i % 17 = 0 then 'on_hold'::public.unit_status
                     when i % 29 = 0 then 'blocked'::public.unit_status
                     else 'available'::public.unit_status end);
      end loop;
    end loop;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- High-rises: 1 tower each — Basement (shops), Ground (shops), Mezzanine (shops),
-- 1st–2nd (offices), 3rd..top-1 (apartments), top (penthouses)
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
          v_rate := case lvl when -1 then 32000 when 0 then 48000 else 38000 end;
        elsif lvl <= 3 then
          v_cat := 'office'; v_use := 'commercial'; v_beds := null;
          v_size := (array[480, 620, 780, 950])[1 + i % 4];
          v_rate := 24000;
        elsif lvl = p.top_floor then
          v_cat := 'penthouse'; v_use := 'residential'; v_beds := 4;
          v_size := (array[3200, 3600])[1 + i % 2];
          v_rate := 26000;
        else
          v_cat := 'apartment'; v_use := 'residential';
          v_beds := (array[1, 2, 2, 3])[1 + n % 4];
          v_size := case v_beds when 1 then 720 when 2 then 1150 else 1650 end;
          v_rate := 18500 + (lvl * 150);                     -- higher floors cost more
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
                case when i % 19 = 0 then 'on_hold'::public.unit_status
                     when i % 41 = 0 then 'blocked'::public.unit_status
                     else 'available'::public.unit_status end);
      end loop;
    end loop;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Clients (fictitious people; CNICs are format-valid sample numbers)
-- ---------------------------------------------------------------------------
insert into public.clients (full_name, relation_type, guardian_name, cnic, passport_no, nationality, is_overseas,
                            phone, whatsapp, email, address, city, country,
                            nok_name, nok_cnic, nok_relation, nok_phone, created_by) values
  ('Muhammad Asif Raja','s/o','Raja Muhammad Akram','37405-1234567-1',null,'Pakistani',false,'+92 300 5123456','+92 300 5123456','asif.raja@example.com','House 12, Street 4, Satellite Town','Rawalpindi','Pakistan','Ayesha Asif','37405-7654321-2','Wife','+92 301 5123456','00000000-0000-4000-a000-000000000003'),
  ('Ayesha Siddiqui','d/o','Kamran Siddiqui','61101-2345678-2',null,'Pakistani',false,'+92 321 5234567','+92 321 5234567','ayesha.s@example.com','House 7, F-10/2','Islamabad','Pakistan','Kamran Siddiqui','61101-8765432-3','Father','+92 333 5234567','00000000-0000-4000-a000-000000000003'),
  ('Tariq Mehmood','s/o','Mehmood Ahmed','37405-3456789-3',null,'Pakistani',false,'+92 333 5345678','+92 333 5345678',null,'Mohalla Dhoke Hassu','Rawalpindi','Pakistan','Saima Tariq','37405-9876543-4','Wife','+92 334 5345678','00000000-0000-4000-a000-000000000003'),
  ('Farah Naz','w/o','Shahid Iqbal','61101-4567890-4',null,'Pakistani',false,'+92 345 5456789','+92 345 5456789','farah.naz@example.com','Apartment 3B, Bahria Enclave','Islamabad','Pakistan','Shahid Iqbal','61101-0987654-5','Husband','+92 300 5456789','00000000-0000-4000-a000-000000000002'),
  ('Usman Ghani Khan','s/o','Ghani Khan','17301-5678901-5','AB1234567','Pakistani',true,'+971 50 1234567','+971 50 1234567','usman.ghani@example.com','Al Nahda 2','Dubai','United Arab Emirates','Gul Khan','17301-1098765-6','Brother','+92 312 5567890','00000000-0000-4000-a000-000000000002'),
  ('Saad Bin Zafar','s/o','Zafar Iqbal','37405-6789012-6',null,'Pakistani',false,'+92 300 5678901','+92 300 5678901',null,'Chaklala Scheme III','Rawalpindi','Pakistan','Zafar Iqbal','37405-2109876-7','Father','+92 300 5678902','00000000-0000-4000-a000-000000000003'),
  ('Nadia Hussain','d/o','Syed Hussain Shah','61101-7890123-7',null,'Pakistani',false,'+92 322 5789012','+92 322 5789012','nadia.h@example.com','House 44, G-11/3','Islamabad','Pakistan','Syed Hussain Shah','61101-3210987-8','Father','+92 322 5789013','00000000-0000-4000-a000-000000000002'),
  ('Kashif Mahmood Butt','s/o','Mahmood Butt','35202-8901234-8','CD7654321','Pakistani',true,'+44 7700 900123','+44 7700 900123','kashif.butt@example.com','14 Grange Road','Birmingham','United Kingdom','Sobia Kashif','35202-4321098-9','Wife','+92 300 5890123','00000000-0000-4000-a000-000000000002'),
  ('Hina Rafiq','w/o','Rafiq Anwar','37405-9012345-9',null,'Pakistani',false,'+92 331 5901234','+92 331 5901234',null,'Westridge I','Rawalpindi','Pakistan','Rafiq Anwar','37405-5432109-1','Husband','+92 331 5901235','00000000-0000-4000-a000-000000000003'),
  ('Adeel Akhtar','s/o','Akhtar Hussain','61101-0123456-1',null,'Pakistani',false,'+92 300 5012345','+92 300 5012345','adeel.akhtar@example.com','Office 9, Blue Area','Islamabad','Pakistan','Akhtar Hussain','61101-6543210-2','Father','+92 300 5012346','00000000-0000-4000-a000-000000000002'),
  ('Rabia Anjum','d/o','Anjum Pervez','37405-1122334-2',null,'Pakistani',false,'+92 333 5112233','+92 333 5112233','rabia.anjum@example.com','Peshawar Road','Rawalpindi','Pakistan','Anjum Pervez','37405-4433221-3','Father','+92 333 5112234','00000000-0000-4000-a000-000000000003'),
  ('Shahzad Ali Abbasi','s/o','Ali Akbar Abbasi','82203-2233445-3',null,'Pakistani',false,'+92 345 5223344','+92 345 5223344',null,'Murree Road','Murree','Pakistan','Ali Akbar Abbasi','82203-5544332-4','Father','+92 345 5223345','00000000-0000-4000-a000-000000000002'),
  ('Mehwish Kiani','w/o','Fahad Kiani','61101-3344556-4',null,'Pakistani',false,'+92 300 5334455','+92 300 5334455','mehwish.k@example.com','DHA Phase II','Islamabad','Pakistan','Fahad Kiani','61101-6655443-5','Husband','+92 300 5334456','00000000-0000-4000-a000-000000000002'),
  ('Waqas Ahmed Janjua','s/o','Ahmed Nawaz Janjua','37405-4455667-5',null,'Pakistani',false,'+92 321 5445566','+92 321 5445566',null,'Gulraiz Housing','Rawalpindi','Pakistan','Ahmed Nawaz Janjua','37405-7766554-6','Father','+92 321 5445567','00000000-0000-4000-a000-000000000003'),
  ('Dr. Sameera Qazi','d/o','Qazi Abdul Rehman','61101-5566778-6','EF2468135','Pakistani',true,'+1 416 555 0142','+1 416 555 0142','sameera.qazi@example.com','88 Bloor St','Toronto','Canada','Qazi Abdul Rehman','61101-8877665-7','Father','+92 300 5556677','00000000-0000-4000-a000-000000000002'),
  ('Faisal Nawaz','s/o','Nawaz Sharif Khan','37405-6677889-7',null,'Pakistani',false,'+92 300 5667788','+92 300 5667788','faisal.nawaz@example.com','Bahria Town Phase 7','Rawalpindi','Pakistan','Nawaz Sharif Khan','37405-9988776-8','Father','+92 300 5667789','00000000-0000-4000-a000-000000000003'),
  ('Zainab Chaudhry','d/o','Chaudhry Aslam','61101-7788990-8',null,'Pakistani',false,'+92 333 5778899','+92 333 5778899',null,'I-8/4','Islamabad','Pakistan','Chaudhry Aslam','61101-0099887-9','Father','+92 333 5778890','00000000-0000-4000-a000-000000000002'),
  ('Hamza Yousaf','s/o','Muhammad Yousaf','37405-8899001-9',null,'Pakistani',false,'+92 345 5889900','+92 345 5889900','hamza.y@example.com','Saddar','Rawalpindi','Pakistan','Muhammad Yousaf','37405-1100998-1','Father','+92 345 5889901','00000000-0000-4000-a000-000000000003'),
  ('Al-Noor Traders (Pvt) Ltd — Rep. Javed Iqbal','s/o','Iqbal Hussain','61101-9900112-1',null,'Pakistani',false,'+92 51 2345678','+92 300 5990011','alnoor@example.com','Office 21, Jinnah Avenue','Islamabad','Pakistan','Iqbal Hussain','61101-2211009-2','Father','+92 300 5990012','00000000-0000-4000-a000-000000000002'),
  ('Sobia Khalid','w/o','Khalid Mehmood','37405-1029384-2',null,'Pakistani',false,'+92 300 5102938','+92 300 5102938',null,'Adiala Road','Rawalpindi','Pakistan','Khalid Mehmood','37405-4839201-3','Husband','+92 300 5102939','00000000-0000-4000-a000-000000000003');

insert into public.dealers (name, agency, phone, default_commission_pct) values
  ('Raja Estate Advisors', 'Raja Estate', '+92 300 5550001', 1.00),
  ('Capital Property Links', 'CPL', '+92 321 5550002', 1.00);

-- ---------------------------------------------------------------------------
-- Payment plans
-- Simco Villas follows SIMCO's own plan: 30% down, then 70% in 8 quarterly installments.
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
-- Sample bookings. These go through the real functions, so every derived value
-- (unit status, ledger, commission, overdue flags) is produced exactly the way
-- the portal produces it. Dates are relative to today so the data stays useful.
-- ---------------------------------------------------------------------------
do $$
declare
  v_agent   uuid := '00000000-0000-4000-a000-000000000003'; -- Bilal Ahmed, sales agent
  v_manager uuid := '00000000-0000-4000-a000-000000000002'; -- Imran Qureshi, manager
  v_acct  uuid := '00000000-0000-4000-a000-000000000004';   -- Sana Malik, accounts
  v_sv    uuid := '10000000-0000-4000-a000-000000000001';
  v_ssq   uuid := '10000000-0000-4000-a000-000000000002';
  v_plan_inst uuid; v_plan_cash uuid; v_plan_std uuid;
  v_today date := (now() at time zone 'Asia/Karachi')::date;
  v_sale public.sales; v_unit uuid; v_c1 uuid; v_c2 uuid; r record; v_i int;
begin
  select id into v_plan_inst from public.payment_plans where project_id = v_sv and kind = 'installment';
  select id into v_plan_cash from public.payment_plans where project_id = v_sv and kind = 'full_cash';
  select id into v_plan_std  from public.payment_plans where project_id is null and is_default;

  -- 1. Full cash, paid in full -> the unit becomes "sold"
  perform set_config('request.jwt.claims', json_build_object('sub', v_agent)::text, false);
  select u.id into v_unit from public.units u join public.blocks b on b.id = u.block_id
   where u.project_id = v_sv and u.status = 'available' and u.category = 'plot'
   order by b.name, u.street, u.unit_no offset 0 limit 1;
  select id into v_c1 from public.clients where cnic = '37405-1234567-1';

  v_sale := public.create_sale(jsonb_build_object(
    'unit_id', v_unit, 'booking_date', v_today - 60, 'plan_kind', 'full_cash',
    'payment_plan_id', v_plan_cash,
    'list_price', (select base_price from public.units where id = v_unit),
    'discount', 0, 'agent_id', v_agent,
    'buyers', jsonb_build_array(jsonb_build_object('client_id', v_c1, 'share_pct', 100, 'is_primary', true))));

  perform set_config('request.jwt.claims', json_build_object('sub', v_acct)::text, false);
  perform public.record_payment(jsonb_build_object(
    'sale_id', v_sale.id, 'received_on', v_today - 58, 'amount', v_sale.final_price,
    'mode', 'pay_order', 'bank_name', 'Meezan Bank', 'instrument_no', 'PO-100241',
    'instrument_date', v_today - 58, 'instrument_status', 'cleared', 'payer_client_id', v_c1));

  -- 2. Installment plan, joint buyers, down payment + 4 installments cleared.
  --    Booked by the Manager because it carries a discount; the agent still owns the sale.
  perform set_config('request.jwt.claims', json_build_object('sub', v_manager)::text, false);
  select u.id into v_unit from public.units u join public.blocks b on b.id = u.block_id
   where u.project_id = v_sv and u.status = 'available' and u.category = 'plot'
   order by b.name, u.street, u.unit_no offset 11 limit 1;
  select id into v_c1 from public.clients where cnic = '61101-2345678-2';
  select id into v_c2 from public.clients where cnic = '37405-3456789-3';

  v_sale := public.create_sale(jsonb_build_object(
    'unit_id', v_unit, 'booking_date', v_today - 400, 'plan_kind', 'installment',
    'payment_plan_id', v_plan_inst,
    'list_price', (select base_price from public.units where id = v_unit),
    'discount', 150000, 'agent_id', v_agent,
    'buyers', jsonb_build_array(
      jsonb_build_object('client_id', v_c1, 'share_pct', 60, 'is_primary', true),
      jsonb_build_object('client_id', v_c2, 'share_pct', 40))));

  perform set_config('request.jwt.claims', json_build_object('sub', v_acct)::text, false);
  v_i := 0;
  for r in select id, amount_due, due_date from public.installments
           where sale_id = v_sale.id order by seq limit 5
  loop
    v_i := v_i + 1;
    perform public.record_payment(jsonb_build_object(
      'sale_id', v_sale.id, 'received_on', r.due_date, 'amount', r.amount_due,
      'mode', case when v_i = 1 then 'bank_transfer' else 'cheque' end,
      'bank_name', 'HBL', 'instrument_no', 'CHQ-' || (560000 + v_i)::text,
      'instrument_date', r.due_date, 'instrument_status', 'cleared', 'payer_client_id', v_c1));
  end loop;

  -- 3. Down payment paid by a cheque that has NOT cleared -> the unit stays "booked"
  perform set_config('request.jwt.claims', json_build_object('sub', v_agent)::text, false);
  select u.id into v_unit from public.units u join public.blocks b on b.id = u.block_id
   where u.project_id = v_sv and u.status = 'available' and u.category = 'plot'
   order by b.name, u.street, u.unit_no offset 44 limit 1;
  select id into v_c1 from public.clients where cnic = '61101-4567890-4';

  v_sale := public.create_sale(jsonb_build_object(
    'unit_id', v_unit, 'booking_date', v_today - 20, 'plan_kind', 'installment',
    'payment_plan_id', v_plan_inst,
    'list_price', (select base_price from public.units where id = v_unit),
    'agent_id', v_agent,
    'buyers', jsonb_build_array(jsonb_build_object('client_id', v_c1, 'share_pct', 100, 'is_primary', true))));

  perform set_config('request.jwt.claims', json_build_object('sub', v_acct)::text, false);
  select id, amount_due into r from public.installments where sale_id = v_sale.id order by seq limit 1;
  perform public.record_payment(jsonb_build_object(
    'sale_id', v_sale.id, 'received_on', v_today - 18, 'amount', r.amount_due,
    'mode', 'cheque', 'bank_name', 'UBL', 'instrument_no', 'CHQ-770145',
    'instrument_date', v_today - 18, 'payer_client_id', v_c1));

  -- 4. Stopped paying after the down payment -> overdue, and flagged for a Manager
  perform set_config('request.jwt.claims', json_build_object('sub', v_agent)::text, false);
  select u.id into v_unit from public.units u join public.blocks b on b.id = u.block_id
   where u.project_id = v_sv and u.status = 'available' and u.category = 'plot'
   order by b.name, u.street, u.unit_no offset 90 limit 1;
  select id into v_c1 from public.clients where cnic = '37405-6789012-6';

  v_sale := public.create_sale(jsonb_build_object(
    'unit_id', v_unit, 'booking_date', v_today - 500, 'plan_kind', 'installment',
    'payment_plan_id', v_plan_inst,
    'list_price', (select base_price from public.units where id = v_unit),
    'agent_id', v_agent,
    'buyers', jsonb_build_array(jsonb_build_object('client_id', v_c1, 'share_pct', 100, 'is_primary', true))));

  perform set_config('request.jwt.claims', json_build_object('sub', v_acct)::text, false);
  select id, amount_due, due_date into r from public.installments where sale_id = v_sale.id order by seq limit 1;
  perform public.record_payment(jsonb_build_object(
    'sale_id', v_sale.id, 'received_on', r.due_date, 'amount', r.amount_due,
    'mode', 'cash', 'payer_client_id', v_c1));

  -- 5. High-rise apartment on the standard 40/50/10 plan (overseas buyer)
  perform set_config('request.jwt.claims', json_build_object('sub', v_agent)::text, false);
  select id into v_unit from public.units where project_id = v_ssq and status = 'available'
    and category = 'apartment' order by unit_no limit 1;
  select id into v_c1 from public.clients where cnic = '17301-5678901-5';

  v_sale := public.create_sale(jsonb_build_object(
    'unit_id', v_unit, 'booking_date', v_today - 100, 'plan_kind', 'installment',
    'payment_plan_id', v_plan_std,
    'list_price', (select base_price from public.units where id = v_unit),
    'agent_id', v_agent,
    'buyers', jsonb_build_array(jsonb_build_object('client_id', v_c1, 'share_pct', 100, 'is_primary', true))));

  perform set_config('request.jwt.claims', json_build_object('sub', v_acct)::text, false);
  select id, amount_due, due_date into r from public.installments where sale_id = v_sale.id order by seq limit 1;
  perform public.record_payment(jsonb_build_object(
    'sale_id', v_sale.id, 'received_on', r.due_date, 'amount', r.amount_due,
    'mode', 'bank_transfer', 'bank_name', 'Standard Chartered', 'instrument_no', 'TT-99812',
    'instrument_date', r.due_date, 'instrument_status', 'cleared', 'payer_client_id', v_c1));

  perform set_config('request.jwt.claims', '', false);
end $$;

-- bring the overdue flags up to date for the seeded history
select public.mark_overdue();
