-- ============================================================
-- Tiger individuals + park / sighting metadata
-- ============================================================
-- Naturalists in Tipai often recognise individual tigers across
-- multiple sightings (same animal, different days, sometimes
-- different observers). This migration introduces a small
-- registry of named tigers plus two new columns on sightings:
--
--   sightings.tiger_id  → tiger_individuals(id) — set when an
--     observer can identify which named tiger they saw.
--
--   sightings.park       → 'tipai' or 'tipeshwar', for any
--     sighting logged without GPS (phones aren't allowed in some
--     reserves). Tiger sightings are the main case but the column
--     is generic — any GPS-less log can record which park.
--
-- Safe to re-run.

-- ─── tiger_individuals ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.tiger_individuals (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  created_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Case-insensitive uniqueness so "Maya" and "maya" can't coexist.
CREATE UNIQUE INDEX IF NOT EXISTS tiger_individuals_name_lower_idx
  ON public.tiger_individuals (lower(name));

ALTER TABLE public.tiger_individuals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tigers_select_authenticated" ON public.tiger_individuals;
CREATE POLICY "tigers_select_authenticated" ON public.tiger_individuals
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "tigers_insert_authenticated" ON public.tiger_individuals;
CREATE POLICY "tigers_insert_authenticated" ON public.tiger_individuals
  FOR INSERT TO authenticated
  WITH CHECK (created_by IS NULL OR created_by = auth.uid());

DROP POLICY IF EXISTS "tigers_update_naturalist" ON public.tiger_individuals;
CREATE POLICY "tigers_update_naturalist" ON public.tiger_individuals
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('naturalist','admin')
    )
  );

DROP POLICY IF EXISTS "tigers_delete_naturalist" ON public.tiger_individuals;
CREATE POLICY "tigers_delete_naturalist" ON public.tiger_individuals
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('naturalist','admin')
    )
  );

-- ─── sightings.tiger_id + sightings.park ─────────────────────

ALTER TABLE public.sightings
  ADD COLUMN IF NOT EXISTS tiger_id uuid
  REFERENCES public.tiger_individuals(id) ON DELETE SET NULL;

ALTER TABLE public.sightings
  ADD COLUMN IF NOT EXISTS park text;

-- Park is a free text column constrained to two known values for now.
-- Using a CHECK rather than an enum keeps it cheap to add a third park
-- later without a migration dance.
ALTER TABLE public.sightings
  DROP CONSTRAINT IF EXISTS sightings_park_check;
ALTER TABLE public.sightings
  ADD CONSTRAINT sightings_park_check
  CHECK (park IS NULL OR park IN ('tipai','tipeshwar'));

CREATE INDEX IF NOT EXISTS sightings_tiger_id_idx
  ON public.sightings(tiger_id);
