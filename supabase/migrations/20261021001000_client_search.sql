-- Digits-only search key so CNIC / phone search works however the number was typed.
alter table public.clients
  add column search_digits text generated always as (
    regexp_replace(coalesce(cnic, ''), '\D', '', 'g') || ' ' ||
    regexp_replace(coalesce(phone, ''), '\D', '', 'g') || ' ' ||
    regexp_replace(coalesce(whatsapp, ''), '\D', '', 'g') || ' ' ||
    regexp_replace(coalesce(nok_phone, ''), '\D', '', 'g')
  ) stored;

create index clients_search_digits_trgm on public.clients using gin (search_digits extensions.gin_trgm_ops);
