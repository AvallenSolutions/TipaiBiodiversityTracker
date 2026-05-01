-- ============================================================
-- Make sightings, media, and edits readable by every signed-in
-- user, regardless of role.
-- ============================================================
-- Bug: a guest/test account opening a species in the Library saw
-- zero sightings, while admins saw all three. The cause was an
-- older restrictive SELECT policy on public.sightings that limited
-- reads to the row owner. The Library is meant to be a shared
-- field record — everyone needs to see what's been observed on
-- the reserve. Insert/update/delete remain gated by ownership +
-- role as before; this only changes who can read.
--
-- Safe to re-run.

-- 1. Sightings: drop ALL existing SELECT policies, recreate one
--    permissive SELECT for authenticated users.
DROP POLICY IF EXISTS "Anyone can read sightings"     ON public.sightings;
DROP POLICY IF EXISTS "Users can read own sightings"  ON public.sightings;
DROP POLICY IF EXISTS "Users can view own sightings"  ON public.sightings;
DROP POLICY IF EXISTS "Users can read sightings"      ON public.sightings;
DROP POLICY IF EXISTS "Naturalists can read sightings" ON public.sightings;
DROP POLICY IF EXISTS "sightings_select_policy"       ON public.sightings;

CREATE POLICY "Authenticated can read all sightings"
  ON public.sightings
  FOR SELECT
  TO authenticated
  USING (true);

-- 2. Sighting media: same treatment so photos render alongside.
DROP POLICY IF EXISTS "Anyone can read media"         ON public.sighting_media;
DROP POLICY IF EXISTS "Users can read own media"      ON public.sighting_media;
DROP POLICY IF EXISTS "sighting_media_select_policy"  ON public.sighting_media;

CREATE POLICY "Authenticated can read all media"
  ON public.sighting_media
  FOR SELECT
  TO authenticated
  USING (true);

-- 3. Sighting edits: keep the audit trail visible to everyone too,
--    matches schema.sql intent.
DROP POLICY IF EXISTS "Anyone can read edits"   ON public.sighting_edits;

CREATE POLICY "Authenticated can read all edits"
  ON public.sighting_edits
  FOR SELECT
  TO authenticated
  USING (true);
