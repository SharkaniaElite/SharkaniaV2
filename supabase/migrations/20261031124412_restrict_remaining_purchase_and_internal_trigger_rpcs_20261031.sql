DO $secure_rpc$
DECLARE fn regprocedure := 'public.check_feature_access(uuid,text)'::regprocedure;
        source text;
BEGIN
  source := replace(pg_get_functiondef(fn), E'\r\n', E'\n');
  IF position('Acceso denegado a compras' IN source) = 0 THEN
    IF position(E'\nBEGIN\n' IN source) = 0 THEN
      RAISE EXCEPTION 'No se encontró BEGIN de la función';
    END IF;
    source := replace(source, E'\nBEGIN\n',
      E'\nBEGIN\n  IF (SELECT auth.uid()) IS DISTINCT FROM p_user_id THEN RAISE EXCEPTION ''Acceso denegado a compras'' USING ERRCODE = ''42501''; END IF;\n');
    EXECUTE source;
  END IF;
END
$secure_rpc$;
REVOKE EXECUTE ON FUNCTION public.check_feature_access(uuid,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_feature_access(uuid,text)
  TO authenticated, service_role;
-- Estas funciones no representan endpoints públicos; una es un trigger y
-- otra procesa una configuración heredada de LAP ya retirada.
REVOKE EXECUTE ON FUNCTION public.update_shark_coins_balance()
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_usd_to_clp()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_shark_coins_balance()
  TO service_role;
GRANT EXECUTE ON FUNCTION public.update_usd_to_clp()
  TO service_role;