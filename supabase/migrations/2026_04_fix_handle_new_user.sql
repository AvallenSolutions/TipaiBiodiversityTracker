-- ============================================================
-- Fix: "Database error saving new user" on staff/naturalist signup
-- Run this in Supabase Dashboard → SQL Editor
-- ============================================================
--
-- Hardens handle_new_user() so it cannot fail the auth.users INSERT:
--   * Role cast into user_role wrapped in its own BEGIN/EXCEPTION block
--   * display_name falls back through three levels to 'Observer'
--   * INSERT becomes idempotent via ON CONFLICT (id) DO UPDATE
--   * Outer EXCEPTION still swallows any remaining error and logs it
--
-- Safe to re-run. Does not touch existing profiles beyond reconciling
-- email/display_name when auth.users is re-upserted.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role user_role := 'guest';
  v_display_name TEXT;
  v_email TEXT;
BEGIN
  v_email := COALESCE(NEW.email, '');

  BEGIN
    v_role := COALESCE(
      (NEW.raw_user_meta_data->>'role')::user_role,
      'guest'
    );
  EXCEPTION WHEN OTHERS THEN
    v_role := 'guest';
  END;

  v_display_name := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'display_name', ''),
    NULLIF(split_part(v_email, '@', 1), ''),
    'Observer'
  );

  INSERT INTO public.profiles (id, email, display_name, role)
  VALUES (NEW.id, v_email, v_display_name, v_role)
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        display_name = COALESCE(public.profiles.display_name, EXCLUDED.display_name),
        role = CASE
                 WHEN public.profiles.role = 'guest' THEN EXCLUDED.role
                 ELSE public.profiles.role
               END;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'handle_new_user failed for %: % %', NEW.id, SQLERRM, SQLSTATE;
  RETURN NEW;
END;
$$;

-- Ensure trigger is attached
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
