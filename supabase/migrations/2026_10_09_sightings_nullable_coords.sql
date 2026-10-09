-- ============================================================
-- Make latitude/longitude nullable on public.sightings (again).
--
-- 2026_04_25_nullable_sighting_coords.sql dropped NOT NULL, but
-- 2026_04_25_realign_sightings_schema.sql ran after it and recreated
-- the table with NOT NULL. Since then every sighting saved without a
-- GPS fix (logged by park instead) fails with:
--   null value in column "latitude" violates not-null constraint
-- Offline sightings without GPS also fail to sync for the same reason.
-- Safe to run more than once.
-- ============================================================

do $$ begin
  if not exists (select 1 from information_schema.tables
                 where table_schema = 'public' and table_name = 'tiger_individuals') then
    raise exception 'WRONG DATABASE: this migration belongs in TipaiBiodiversityTracker (cojowcpaclcqiyrkbhyv)';
  end if;
end $$;

alter table public.sightings alter column latitude  drop not null;
alter table public.sightings alter column longitude drop not null;
