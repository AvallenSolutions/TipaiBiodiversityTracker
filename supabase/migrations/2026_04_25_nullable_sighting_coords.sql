-- ============================================================
-- Make lat/lng nullable on public.sightings so offline-logged
-- sightings can be persisted when the device hasn't acquired a
-- GPS fix yet. The application's sync flow surfaces these
-- records for location backfill once the user is back online.
-- ============================================================

ALTER TABLE public.sightings ALTER COLUMN latitude  DROP NOT NULL;
ALTER TABLE public.sightings ALTER COLUMN longitude DROP NOT NULL;
