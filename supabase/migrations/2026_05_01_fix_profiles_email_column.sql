-- ============================================================
-- Add missing email column to public.profiles and fix trigger
-- ============================================================
-- Root cause: the live database was created with an older schema
-- that did not include an email column on public.profiles. Every
-- call to handle_new_user() crashed silently (EXCEPTION WHEN OTHERS
-- swallows the error) because it tried to INSERT into a column that
-- didn't exist — leaving public.profiles permanently empty.
--
-- This migration:
--   1. Adds the email column (nullable to avoid breaking existing rows)
--   2. Backfills it from auth.users for anyone who already signed up
--   3. Replaces handle_new_user() with a version that matches the
--      actual table structure
--
-- Safe to re-run.

-- 1. Add email column if missing
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email TEXT;

-- 2. Backfill email for any existing profile rows
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id
  AND p.email IS NULL;

-- 3. Backfill missing profile rows for users who never got one
--    (because the trigger was silently failing)
INSERT INTO public.profiles (id, email, display_name, role)
SELECT
  u.id,
  u.email,
  COALESCE(
    NULLIF(u.raw_user_meta_data->>'display_name', ''),
    NULLIF(split_part(u.email, '@', 1), ''),
    'Observer'
  ),
  'guest'
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- 4. Replace the trigger function so it correctly includes email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_display_name TEXT;
  v_email TEXT;
BEGIN
  v_email := COALESCE(NEW.email, '');

  v_display_name := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'display_name', ''),
    NULLIF(split_part(v_email, '@', 1), ''),
    'Observer'
  );

  INSERT INTO public.profiles (id, email, display_name, role)
  VALUES (NEW.id, v_email, v_display_name, 'guest')
  ON CONFLICT (id) DO UPDATE
    SET email        = EXCLUDED.email,
        display_name = COALESCE(public.profiles.display_name, EXCLUDED.display_name);
        -- role intentionally omitted: never auto-promote, never demote.

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'handle_new_user failed for %: % %', NEW.id, SQLERRM, SQLSTATE;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
