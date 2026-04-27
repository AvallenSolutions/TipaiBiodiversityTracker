-- ============================================================
-- Harden handle_new_user() so the client cannot self-promote on signup
-- ============================================================
--
-- Background: the previous trigger read `raw_user_meta_data->>'role'`
-- straight into the new profile. Anyone hitting /signup could pick
-- 'staff' or 'naturalist' (or with a tweaked client, 'admin') and land
-- in the database with elevated privileges.
--
-- New rule: the trigger always inserts new profiles with role='guest'.
-- Display name is still pulled from metadata for convenience. Existing
-- profiles are untouched — admins promote users to staff/naturalist
-- via the Admin page after signup.
--
-- Safe to re-run.

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

  -- Always create new accounts as 'guest'. Promotion to staff,
  -- naturalist, or admin must go through public.profiles via the
  -- Admin page (which is itself gated to admins by RLS).
  INSERT INTO public.profiles (id, email, display_name, role)
  VALUES (NEW.id, v_email, v_display_name, 'guest')
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        display_name = COALESCE(public.profiles.display_name, EXCLUDED.display_name);
        -- role intentionally not in the SET clause — never demote, never auto-promote.

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'handle_new_user failed for %: % %', NEW.id, SQLERRM, SQLSTATE;
  RETURN NEW;
END;
$$;

-- Trigger is already attached by an earlier migration; re-attach defensively.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
