-- ============================================================
-- AI identifier v2: learned photo memory, look-alike tips and
-- accuracy stats.
--
-- species_examples      one row per confirmed sighting photo. The
--                       identify-species edge function embeds a small
--                       thumbnail with gemini-embedding-2 and searches
--                       these rows for similar confirmed Tipai photos.
--                       Written only by the edge function (service role)
--                       after a naturalist or admin confirms a sighting.
-- species_lookalike_tips short naturalist notes on telling two species
--                       apart. Fed into the prompt when either species is
--                       a candidate.
-- ai_accuracy_stats()   top-1 / top-3 hit rates and most-confused pairs,
--                       for the admin "AI accuracy" panel.
-- ============================================================

-- Guard: this migration belongs in the TipaiBiodiversityTracker project.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                 WHERE table_schema = 'public' AND table_name = 'tiger_individuals') THEN
    RAISE EXCEPTION 'WRONG DATABASE: this migration belongs in TipaiBiodiversityTracker (cojowcpaclcqiyrkbhyv)';
  END IF;
END $$;

CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- 1. Learned photo memory
CREATE TABLE IF NOT EXISTS public.species_examples (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sighting_id UUID NOT NULL UNIQUE REFERENCES public.sightings(id) ON DELETE CASCADE,
  species_id UUID REFERENCES public.species(id) ON DELETE SET NULL,
  common_name TEXT NOT NULL,
  scientific_name TEXT,
  category sighting_category NOT NULL,
  -- Thumbnail (long edge ~768px) in the sighting-media bucket.
  storage_path TEXT NOT NULL,
  embedding extensions.vector(768) NOT NULL,
  confirmed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_species_examples_embedding
  ON public.species_examples USING hnsw (embedding extensions.vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_species_examples_species_id
  ON public.species_examples(species_id);
CREATE INDEX IF NOT EXISTS idx_species_examples_common_name
  ON public.species_examples(lower(common_name));

DROP TRIGGER IF EXISTS set_species_examples_updated_at ON public.species_examples;
CREATE TRIGGER set_species_examples_updated_at
  BEFORE UPDATE ON public.species_examples
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.species_examples ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read species examples" ON public.species_examples;
CREATE POLICY "Anyone can read species examples" ON public.species_examples
  FOR SELECT TO authenticated USING (true);
-- No insert/update/delete policies: only the edge function (service role)
-- writes here, after checking the caller is a naturalist or admin.

-- 2. Look-alike tips
CREATE TABLE IF NOT EXISTS public.species_lookalike_tips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  species_a TEXT NOT NULL,
  species_b TEXT NOT NULL,
  tip TEXT NOT NULL CHECK (length(tip) BETWEEN 3 AND 500),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.species_lookalike_tips ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read lookalike tips" ON public.species_lookalike_tips;
CREATE POLICY "Anyone can read lookalike tips" ON public.species_lookalike_tips
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Naturalists can add lookalike tips" ON public.species_lookalike_tips;
CREATE POLICY "Naturalists can add lookalike tips" ON public.species_lookalike_tips
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND public.get_my_role() IN ('naturalist', 'admin'));

DROP POLICY IF EXISTS "Naturalists can delete lookalike tips" ON public.species_lookalike_tips;
CREATE POLICY "Naturalists can delete lookalike tips" ON public.species_lookalike_tips
  FOR DELETE TO authenticated USING (public.get_my_role() IN ('naturalist', 'admin'));

-- 3. Nearest-neighbour search over the photo memory (edge function only)
CREATE OR REPLACE FUNCTION public.match_species_examples(
  query_embedding extensions.vector(768),
  match_count INT DEFAULT 8,
  exclude_sighting UUID DEFAULT NULL
)
RETURNS TABLE (
  sighting_id UUID,
  species_id UUID,
  common_name TEXT,
  scientific_name TEXT,
  category sighting_category,
  storage_path TEXT,
  similarity DOUBLE PRECISION
)
LANGUAGE sql STABLE
SET search_path = public, extensions
AS $$
  SELECT e.sighting_id, e.species_id, e.common_name, e.scientific_name,
         e.category, e.storage_path,
         1 - (e.embedding <=> query_embedding) AS similarity
  FROM public.species_examples e
  WHERE exclude_sighting IS NULL OR e.sighting_id <> exclude_sighting
  ORDER BY e.embedding <=> query_embedding
  LIMIT match_count;
$$;

REVOKE ALL ON FUNCTION public.match_species_examples(extensions.vector, INT, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.match_species_examples(extensions.vector, INT, UUID) TO service_role;

-- 4. Accuracy stats
CREATE OR REPLACE FUNCTION public.ai_norm(x TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT lower(regexp_replace(coalesce(x, ''), '[^a-zA-Z]', '', 'g'));
$$;

-- True when one AI suggestion (jsonb) names the same species as the
-- final record: same library id, or same normalised common or scientific name.
CREATE OR REPLACE FUNCTION public.ai_same_species(v JSONB, sid UUID, cname TEXT, sname TEXT)
RETURNS BOOLEAN LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT
    (sid IS NOT NULL AND v->>'species_id' IS NOT NULL AND v->>'species_id' = sid::text)
    OR (public.ai_norm(v->>'common_name') <> '' AND public.ai_norm(v->>'common_name') = public.ai_norm(cname))
    OR (public.ai_norm(v->>'scientific_name') <> '' AND public.ai_norm(v->>'scientific_name') = public.ai_norm(sname));
$$;

CREATE OR REPLACE FUNCTION public.ai_accuracy_stats(since TIMESTAMPTZ DEFAULT now() - INTERVAL '365 days')
RETURNS JSONB
LANGUAGE sql STABLE
SET search_path = public
AS $$
  WITH s AS (
    SELECT id, created_at, species_id, common_name, scientific_name, ai_suggestions,
           coalesce(ai_suggestions->0->>'engine', 'v1') AS engine
    FROM public.sightings
    WHERE ai_suggestions IS NOT NULL
      AND jsonb_typeof(ai_suggestions) = 'array'
      AND jsonb_array_length(ai_suggestions) > 0
      AND common_name IS NOT NULL
      AND verification_status <> 'rejected'
      AND created_at >= since
  ),
  scored AS (
    SELECT s.*,
      EXISTS (SELECT 1 FROM jsonb_array_elements(s.ai_suggestions) WITH ORDINALITY e(v, i)
              WHERE i = 1 AND public.ai_same_species(e.v, s.species_id, s.common_name, s.scientific_name)) AS top1,
      EXISTS (SELECT 1 FROM jsonb_array_elements(s.ai_suggestions) WITH ORDINALITY e(v, i)
              WHERE i <= 3 AND public.ai_same_species(e.v, s.species_id, s.common_name, s.scientific_name)) AS top3
    FROM s
  )
  SELECT jsonb_build_object(
    'by_engine', coalesce((
      SELECT jsonb_agg(jsonb_build_object('engine', engine, 'total', total, 'top1', top1, 'top3', top3) ORDER BY engine)
      FROM (SELECT engine, count(*) AS total,
                   count(*) FILTER (WHERE top1) AS top1,
                   count(*) FILTER (WHERE top3) AS top3
            FROM scored GROUP BY engine) x
    ), '[]'::jsonb),
    'by_month', coalesce((
      SELECT jsonb_agg(jsonb_build_object('month', month, 'total', total, 'top1', top1, 'top3', top3) ORDER BY month)
      FROM (SELECT to_char(date_trunc('month', created_at), 'YYYY-MM') AS month, count(*) AS total,
                   count(*) FILTER (WHERE top1) AS top1,
                   count(*) FILTER (WHERE top3) AS top3
            FROM scored GROUP BY 1) m
    ), '[]'::jsonb),
    'confusions', coalesce((
      SELECT jsonb_agg(jsonb_build_object('ai_said', ai_said, 'actual', actual, 'count', n) ORDER BY n DESC, actual)
      FROM (SELECT ai_suggestions->0->>'common_name' AS ai_said, common_name AS actual, count(*) AS n
            FROM scored WHERE NOT top1 GROUP BY 1, 2 ORDER BY 3 DESC LIMIT 15) c
    ), '[]'::jsonb),
    'examples', (SELECT count(*) FROM public.species_examples),
    'tips', (SELECT count(*) FROM public.species_lookalike_tips)
  );
$$;

GRANT EXECUTE ON FUNCTION public.ai_accuracy_stats(TIMESTAMPTZ) TO authenticated;
