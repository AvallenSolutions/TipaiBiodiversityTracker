-- ============================================================
-- admin_delete_user() RPC
-- ============================================================
-- Callable by authenticated clients; enforces role='admin'
-- server-side so a rogue client cannot bypass it.
-- Deletes the auth.users row — the ON DELETE CASCADE on
-- public.profiles removes the profile automatically.
-- Self-deletion is blocked.

CREATE OR REPLACE FUNCTION public.admin_delete_user(target_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF (SELECT role FROM public.profiles WHERE id = auth.uid()) <> 'admin' THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  IF target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot delete your own account';
  END IF;

  DELETE FROM auth.users WHERE id = target_user_id;
END;
$$;

-- Only authenticated users can call it; the body re-checks for admin.
REVOKE ALL ON FUNCTION public.admin_delete_user(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(UUID) TO authenticated;
