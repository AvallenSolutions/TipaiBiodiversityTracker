-- ============================================================
-- Tipai Biodiversity Tracker — Full Database Schema
-- Run this in Supabase SQL Editor to set up the database
-- ============================================================

-- 1. ENUMS
-- ============================================================
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('guest', 'staff', 'naturalist', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE sighting_category AS ENUM ('mammal', 'bird', 'reptile', 'amphibian', 'insect', 'plant', 'fungi', 'trace');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

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

-- 2. HELPER FUNCTIONS
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 3. TABLES
-- ============================================================

-- Profiles (1:1 with auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT,
  role user_role NOT NULL DEFAULT 'guest',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Species reference database
CREATE TABLE IF NOT EXISTS public.species (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  common_name TEXT NOT NULL,
  scientific_name TEXT,
  category sighting_category NOT NULL,
  subcategory TEXT,
  description TEXT,
  habitat TEXT,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(common_name, category)
);

-- Sightings
CREATE TABLE IF NOT EXISTS public.sightings (
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

-- Sighting media
CREATE TABLE IF NOT EXISTS public.sighting_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sighting_id UUID NOT NULL REFERENCES public.sightings(id) ON DELETE CASCADE,
  media_type media_type NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  size_bytes INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Edit audit trail
CREATE TABLE IF NOT EXISTS public.sighting_edits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sighting_id UUID NOT NULL REFERENCES public.sightings(id) ON DELETE CASCADE,
  edited_by UUID NOT NULL REFERENCES public.profiles(id),
  changes JSONB NOT NULL,
  edit_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- HELPER: get_my_role (must be after profiles table)
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS user_role LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

-- 4. TRIGGERS
-- ============================================================

-- Auto-update updated_at
DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_sightings_updated_at ON public.sightings;
CREATE TRIGGER set_sightings_updated_at
  BEFORE UPDATE ON public.sightings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(
      NEW.raw_user_meta_data->>'display_name',
      split_part(COALESCE(NEW.email, ''), '@', 1)
    ),
    COALESCE(
      (NEW.raw_user_meta_data->>'role')::user_role,
      'guest'
    )
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'handle_new_user failed: % %', SQLERRM, SQLSTATE;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5. ROW LEVEL SECURITY
-- ============================================================

-- Profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read profiles" ON public.profiles;
CREATE POLICY "Anyone can read profiles" ON public.profiles
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (id = auth.uid());

DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
CREATE POLICY "Admins can update any profile" ON public.profiles
  FOR UPDATE TO authenticated USING (public.get_my_role() = 'admin');

-- Species
ALTER TABLE public.species ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read species" ON public.species;
CREATE POLICY "Anyone can read species" ON public.species
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins can manage species" ON public.species;
CREATE POLICY "Admins can manage species" ON public.species
  FOR ALL TO authenticated USING (public.get_my_role() IN ('admin', 'naturalist'));

-- Sightings
ALTER TABLE public.sightings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read sightings" ON public.sightings;
CREATE POLICY "Anyone can read sightings" ON public.sightings
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can insert own sightings" ON public.sightings;
CREATE POLICY "Users can insert own sightings" ON public.sightings
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own sightings" ON public.sightings;
CREATE POLICY "Users can update own sightings" ON public.sightings
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Naturalists can update any sighting" ON public.sightings;
CREATE POLICY "Naturalists can update any sighting" ON public.sightings
  FOR UPDATE TO authenticated USING (public.get_my_role() IN ('naturalist', 'admin'));

DROP POLICY IF EXISTS "Admins can delete sightings" ON public.sightings;
CREATE POLICY "Admins can delete sightings" ON public.sightings
  FOR DELETE TO authenticated USING (
    user_id = auth.uid() OR public.get_my_role() IN ('naturalist', 'admin')
  );

-- Sighting media
ALTER TABLE public.sighting_media ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read media" ON public.sighting_media;
CREATE POLICY "Anyone can read media" ON public.sighting_media
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can insert media" ON public.sighting_media;
CREATE POLICY "Users can insert media" ON public.sighting_media
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Users can delete own media" ON public.sighting_media;
CREATE POLICY "Users can delete own media" ON public.sighting_media
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.sightings WHERE id = sighting_id AND user_id = auth.uid())
    OR public.get_my_role() IN ('naturalist', 'admin')
  );

-- Sighting edits
ALTER TABLE public.sighting_edits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read edits" ON public.sighting_edits;
CREATE POLICY "Anyone can read edits" ON public.sighting_edits
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated can insert edits" ON public.sighting_edits;
CREATE POLICY "Authenticated can insert edits" ON public.sighting_edits
  FOR INSERT TO authenticated WITH CHECK (edited_by = auth.uid());

-- 6. STORAGE BUCKETS
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('sighting-media', 'sighting-media', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
DROP POLICY IF EXISTS "Authenticated users can upload media" ON storage.objects;
CREATE POLICY "Authenticated users can upload media" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'sighting-media');

DROP POLICY IF EXISTS "Public media read access" ON storage.objects;
CREATE POLICY "Public media read access" ON storage.objects
  FOR SELECT USING (bucket_id = 'sighting-media');

DROP POLICY IF EXISTS "Users can delete own media files" ON storage.objects;
CREATE POLICY "Users can delete own media files" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'sighting-media' AND (storage.foldername(name))[1] = auth.uid()::text);

-- 7. INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_sightings_user_id ON public.sightings(user_id);
CREATE INDEX IF NOT EXISTS idx_sightings_category ON public.sightings(category);
CREATE INDEX IF NOT EXISTS idx_sightings_sighted_at ON public.sightings(sighted_at DESC);
CREATE INDEX IF NOT EXISTS idx_sightings_verification ON public.sightings(verification_status);
CREATE INDEX IF NOT EXISTS idx_sighting_media_sighting ON public.sighting_media(sighting_id);
CREATE INDEX IF NOT EXISTS idx_sighting_edits_sighting ON public.sighting_edits(sighting_id);
CREATE INDEX IF NOT EXISTS idx_species_category ON public.species(category);
