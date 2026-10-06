-- ============================================================
-- Field notes + naturalist review
--
-- 1. The logging screen has always asked for sex & age, behaviour,
--    habitat, weather and the observer's confidence, but there were no
--    columns for them, so the answers were thrown away. Store them.
-- 2. Record who reviewed a sighting and when. A trigger stamps these
--    whenever a sighting is saved as verified or rejected, so every path
--    (review list, detail view, quick verify, logging by a naturalist)
--    is covered without client code.
-- ============================================================

-- Guard: this migration belongs in the TipaiBiodiversityTracker project.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                 WHERE table_schema = 'public' AND table_name = 'tiger_individuals') THEN
    RAISE EXCEPTION 'WRONG DATABASE: this migration belongs in TipaiBiodiversityTracker (cojowcpaclcqiyrkbhyv)';
  END IF;
END $$;

ALTER TABLE public.sightings
  ADD COLUMN IF NOT EXISTS sex_age TEXT,
  ADD COLUMN IF NOT EXISTS behaviour TEXT,
  ADD COLUMN IF NOT EXISTS habitat TEXT,
  ADD COLUMN IF NOT EXISTS weather TEXT,
  ADD COLUMN IF NOT EXISTS observer_confidence TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.stamp_sighting_review()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.verification_status IN ('verified', 'rejected')
     AND (TG_OP = 'INSERT' OR NEW.verification_status IS DISTINCT FROM OLD.verification_status) THEN
    NEW.reviewed_by := coalesce(auth.uid(), NEW.reviewed_by);
    NEW.reviewed_at := now();
  ELSIF NEW.verification_status IN ('unverified', 'ai_suggested') THEN
    NEW.reviewed_by := NULL;
    NEW.reviewed_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS stamp_sighting_review ON public.sightings;
CREATE TRIGGER stamp_sighting_review
  BEFORE INSERT OR UPDATE OF verification_status ON public.sightings
  FOR EACH ROW EXECUTE FUNCTION public.stamp_sighting_review();

CREATE INDEX IF NOT EXISTS idx_sightings_needs_review
  ON public.sightings(created_at DESC)
  WHERE verification_status IN ('unverified', 'ai_suggested');
