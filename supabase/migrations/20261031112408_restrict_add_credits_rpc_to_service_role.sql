REVOKE EXECUTE ON FUNCTION public.add_credits_to_user(uuid, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_credits_to_user(uuid, integer, text) TO service_role;