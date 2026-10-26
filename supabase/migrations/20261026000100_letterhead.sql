-- Project letterhead: the PDF placed behind printed documents, and the safe area (mm) that keeps
-- document text clear of its artwork. Defaults are measured from the SIMCO VILLAS letterhead (A4):
--   header logos 11–35 mm from the top; tagline "SPACES FOR A BRIGHTER TOMORROW" down the left edge
--   to 74 mm (x up to 39 mm); footer rule at 272 mm; side margins aligned with the artwork.
--
-- Body text starts at letterhead_top_mm on every page (every sheet of letterhead stock carries the
-- tagline). On page 1 the document heading (title, ref/date, addressee) goes higher, in the free
-- space beside the tagline: from letterhead_head_top_mm, starting letterhead_head_left_mm from the left.

alter table public.project_document_settings
  add column letterhead_path         text,                                  -- branding/letterheads/{project}/…pdf
  add column letterhead_top_mm       numeric(5,1) not null default 80   check (letterhead_top_mm between 0 and 200),
  add column letterhead_bottom_mm    numeric(5,1) not null default 28.5 check (letterhead_bottom_mm between 0 and 120),
  add column letterhead_left_mm      numeric(5,1) not null default 16.2 check (letterhead_left_mm between 0 and 60),
  add column letterhead_right_mm     numeric(5,1) not null default 10   check (letterhead_right_mm between 0 and 60),
  add column letterhead_head_top_mm  numeric(5,1) default 40           check (letterhead_head_top_mm between 0 and 200),
  add column letterhead_head_left_mm numeric(5,1) default 42           check (letterhead_head_left_mm between 0 and 150),
  add constraint letterhead_head_above_body check (letterhead_head_top_mm is null or letterhead_head_top_mm < letterhead_top_mm);

comment on column public.project_document_settings.letterhead_head_top_mm is
  'Page-1 heading position beside the tagline; null = heading flows at the top of the body instead';

-- Letterheads are PDFs: allow them in the branding bucket.
update storage.buckets
   set allowed_mime_types = array['image/jpeg','image/png','image/webp','image/svg+xml','application/pdf'],
       file_size_limit = 10485760
 where id = 'branding';
