-- DO NOT APPLY TO PRODUCTION. Test-only adapter for stable client RPC name.
-- The actual production cutover must install the reviewed, complete,
-- non-_qa server body; never deploy this forwarding wrapper as a migration.
-- In disposable QA the complete validation and authorization lives in
-- publish_league_nickname_results_guarded_qa from PR #88.
CREATE OR REPLACE FUNCTION public.publish_league_nickname_results_guarded(
  p_tournament_id uuid,
  p_results jsonb
)
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path TO ''
AS $qa$
  SELECT public.publish_league_nickname_results_guarded_qa(p_tournament_id,p_results);
$qa$;

REVOKE ALL ON FUNCTION public.publish_league_nickname_results_guarded(uuid,jsonb)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.publish_league_nickname_results_guarded(uuid,jsonb)
 TO authenticated;

-- Fail closed if a function is unexpectedly world-executable.
DO $qa$
BEGIN
  IF pg_catalog.has_function_privilege('anon',
       'public.publish_league_nickname_results_guarded(uuid,jsonb)','EXECUTE')
    OR NOT pg_catalog.has_function_privilege('authenticated',
       'public.publish_league_nickname_results_guarded(uuid,jsonb)','EXECUTE')
  THEN
    RAISE EXCEPTION 'Unexpected client RPC grants'
      USING ERRCODE='PT409';
  END IF;
END;
$qa$;
