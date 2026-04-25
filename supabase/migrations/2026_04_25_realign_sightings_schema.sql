-- ============================================================
-- Realign the sightings/media/edits tables with the canonical
-- schema in supabase/schema.sql.
--
-- Background: the live database had drifted to an older generation
-- of the data model (species_name, count, confidence enum,
-- ai_suggestion singular, status enum, observed_at, geom, sync_status,
-- version, etc.). The application code targets the columns defined
-- in schema.sql (common_name, scientific_name, individual_count,
-- ai_confidence REAL, ai_suggestions JSONB, verification_status,
-- sighted_at NOT NULL, inaturalist_status, ebird_status). Every
-- insert from the app was therefore being rejected by PostgREST.
--
-- This migration is destructive on sighting data only — run it AFTER
-- you have wiped existing rows (which is what we did). profiles and
-- species are untouched.
-- ============================================================

-- 1. Drop the three sighting-related tables. CASCADE removes any
--    foreign keys that pointed at them (none should remain after the
--    earlier wipe, but be explicit).
DROP TABLE IF EXISTS public.sighting_edits CASCADE;
DROP TABLE IF EXISTS public.sighting_media CASCADE;
DROP TABLE IF EXISTS public.sightings        CASCADE;

-- 2. Ensure the canonical enums exist. These are idempotent.
DO $$ BEGIN
  CREATE TYPE verification_status AS ENUM ('unverified', 'ai_suggested', 'verified', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE export_status AS ENUM ('not_exported', 'pending', 'exported', 'excluded', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE media_type AS ENUM ('photo', 'video', 'audio');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3. Recreate sightings with the canonical column set.
CREATE TABLE public.sightings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  species_id UUID REFERENCES public.species(id) ON DELETE SET NULL,
  category sighting_category NOT NULL,
  common_name TEXT,
  scientific_name TEXT,
  notes TEXT,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  location_accuracy DOUBLE PRECISION,
  sighted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  verification_status verification_status NOT NULL DEFAULT 'unverified',
  ai_confidence REAL,
  ai_suggestions JSONB,
  inaturalist_status export_status NOT NULL DEFAULT 'not_exported',
  ebird_status export_status NOT NULL DEFAULT 'not_exported',
  individual_count INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Recreate sighting_media.
CREATE TABLE public.sighting_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sighting_id UUID NOT NULL REFERENCES public.sightings(id) ON DELETE CASCADE,
  media_type media_type NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  size_bytes INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Recreate sighting_edits (audit trail).
CREATE TABLE public.sighting_edits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sighting_id UUID NOT NULL REFERENCES public.sightings(id) ON DELETE CASCADE,
  edited_by UUID NOT NULL REFERENCES public.profiles(id),
  changes JSONB NOT NULL,
  edit_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Re-attach the updated_at trigger.
DROP TRIGGER IF EXISTS set_sightings_updated_at ON public.sightings;
CREATE TRIGGER set_sightings_updated_at
  BEFORE UPDATE ON public.sightings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 7. Re-enable RLS and reapply policies.
ALTER TABLE public.sightings      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sighting_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sighting_edits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read sightings"          ON public.sightings;
CREATE POLICY "Anyone can read sightings" ON public.sightings
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can insert own sightings"     ON public.sightings;
CREATE POLICY "Users can insert own sightings" ON public.sightings
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own sightings"     ON public.sightings;
CREATE POLICY "Users can update own sightings" ON public.sightings
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Naturalists can update any sighting" ON public.sightings;
CREATE POLICY "Naturalists can update any sighting" ON public.sightings
  FOR UPDATE TO authenticated USING (public.get_my_role() IN ('naturalist', 'admin'));

DROP POLICY IF EXISTS "Admins can delete sightings"        ON public.sightings;
CREATE POLICY "Admins can delete sightings" ON public.sightings
  FOR DELETE TO authenticated USING (
    user_id = auth.uid() OR public.get_my_role() IN ('naturalist', 'admin')
  );

DROP POLICY IF EXISTS "Anyone can read media"              ON public.sighting_media;
CREATE POLICY "Anyone can read media" ON public.sighting_media
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can insert media"             ON public.sighting_media;
CREATE POLICY "Users can insert media" ON public.sighting_media
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Users can delete own media"         ON public.sighting_media;
CREATE POLICY "Users can delete own media" ON public.sighting_media
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.sightings WHERE id = sighting_id AND user_id = auth.uid())
    OR public.get_my_role() IN ('naturalist', 'admin')
  );

DROP POLICY IF EXISTS "Anyone can read edits"              ON public.sighting_edits;
CREATE POLICY "Anyone can read edits" ON public.sighting_edits
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated can insert edits"     ON public.sighting_edits;
CREATE POLICY "Authenticated can insert edits" ON public.sighting_edits
  FOR INSERT TO authenticated WITH CHECK (edited_by = auth.uid());

-- 8. Recreate the indexes.
CREATE INDEX IF NOT EXISTS idx_sightings_user_id        ON public.sightings(user_id);
CREATE INDEX IF NOT EXISTS idx_sightings_category       ON public.sightings(category);
CREATE INDEX IF NOT EXISTS idx_sightings_sighted_at     ON public.sightings(sighted_at DESC);
CREATE INDEX IF NOT EXISTS idx_sightings_verification   ON public.sightings(verification_status);
CREATE INDEX IF NOT EXISTS idx_sighting_media_sighting  ON public.sighting_media(sighting_id);
CREATE INDEX IF NOT EXISTS idx_sighting_edits_sighting  ON public.sighting_edits(sighting_id);
