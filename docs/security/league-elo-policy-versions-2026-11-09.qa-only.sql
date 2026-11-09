-- SHARKANIA ELO POLICIES: EXPLORATORY QA, NOT A PRODUCTION MIGRATION.
-- Do not apply to Supabase production or enable any new writer based on this.
-- This function is a no-write policy calculator in a PRIVATE QA schema.
-- Legacy v1 is derived from src/lib/api/elo-engine.ts as currently deployed.
-- v2 proposal deliberately does NOT use numeric buy-in for the K factor.
-- Only an approved business decision may assign an effective version/date.
CREATE OR REPLACE FUNCTION sharkania_release_qa.quote_elo_policy_qa(
 p_algorithm_version text,
 p_currency text,
 p_buy_in numeric,
 p_rating_before numeric,
 p_total_tournaments integer,
 p_position integer,
 p_field_ratings numeric[]
)
RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path TO ''
AS $elo_policy$
DECLARE
  v_count integer;
  v_sum numeric;
  v_average numeric;
  v_score numeric;
  v_expected numeric;
  v_k_base numeric;
  v_k numeric;
  v_weight numeric;
  v_raw_change numeric;
  v_after numeric;
BEGIN
 IF p_algorithm_version IS NULL OR p_algorithm_version NOT IN (
   'legacy-js-v1','currency-neutral-v2-PROPOSAL'
 ) THEN
   RAISE EXCEPTION 'Unapproved Elo version' USING ERRCODE='PT422';
 END IF;
 IF p_currency IS NULL OR p_currency NOT IN ('USD','EUR','CLP')
 OR p_buy_in IS NULL OR p_buy_in<0
 OR p_rating_before IS NULL OR p_rating_before<100
 OR p_total_tournaments IS NULL OR p_total_tournaments<0
 THEN
   RAISE EXCEPTION 'Invalid Elo currency, buy-in or player state'
     USING ERRCODE='PT422';
 END IF;

 v_count:=pg_catalog.cardinality(p_field_ratings);
 IF v_count IS NULL OR v_count NOT BETWEEN 2 AND 1000
    OR p_position IS NULL OR p_position<1 OR p_position>v_count
    OR pg_catalog.array_position(p_field_ratings,NULL::numeric) IS NOT NULL
    OR p_rating_before<>ALL(p_field_ratings)
 THEN
   -- A field must include the player's own rating; duplicate numeric
   -- ratings are legal since distinct players can share an Elo.
   IF p_rating_before<>ALL(p_field_ratings) THEN
     RAISE EXCEPTION 'Player Elo absent from field'
       USING ERRCODE='PT422';
   END IF;
   RAISE EXCEPTION 'Invalid ordered Elo field or position'
     USING ERRCODE='PT422';
 END IF;
 SELECT pg_catalog.sum(x) INTO v_sum
 FROM pg_catalog.unnest(p_field_ratings) AS vals(x);
 IF v_sum IS NULL OR EXISTS (
    SELECT 1 FROM pg_catalog.unnest(p_field_ratings) AS vals(x)
    WHERE x<100
 ) THEN
   RAISE EXCEPTION 'Invalid ratings in Elo field' USING ERRCODE='PT422';
 END IF;

 v_average:=v_sum/v_count;
 v_score:=(v_count-p_position)::numeric/(v_count-1);
 v_expected:=1/(1+pg_catalog.power(10::numeric,
      ((v_sum-p_rating_before)/(v_count-1)-p_rating_before)/400));
 v_weight:=v_average/1200;
 v_k_base:=CASE WHEN p_total_tournaments<30 THEN 40 ELSE 20 END;

 -- Ranking size contributes to both rules. The old factor adds
 -- log10(buy_in+1) WITHOUT looking at p_currency; this is a historical
 -- numerical property, not an approved FX rate.
 v_k:=v_k_base*(1+pg_catalog.log(v_count::numeric)*0.15);
 IF p_algorithm_version='legacy-js-v1' THEN
   v_k:=v_k*(1+pg_catalog.log(p_buy_in+1)*0.1);
 END IF;

 v_raw_change:=v_k*v_weight*(v_score-v_expected);
 v_after:=GREATEST(100::numeric,p_rating_before+v_raw_change);

 RETURN pg_catalog.jsonb_build_object(
  'algorithm_version',p_algorithm_version,
  'currency',p_currency,
  'currency_affects_elo',false,
  'buy_in_affects_elo',(p_algorithm_version='legacy-js-v1'),
  'approval_status','QA_PROPOSAL_NOT_ACTIVE',
  'participants',v_count,
  'k',pg_catalog.round(v_k,6),
  'elo_before',p_rating_before,
  'elo_after',pg_catalog.round(v_after,2),
  'elo_change',pg_catalog.round(v_raw_change,2)
 );
END;
$elo_policy$;

-- Every new function is executable by PUBLIC by default unless revoked.
-- Both versions are strictly private and no business records are modified.
REVOKE ALL ON FUNCTION sharkania_release_qa.quote_elo_policy_qa(
  text,text,numeric,numeric,integer,integer,numeric[]
) FROM PUBLIC,anon,authenticated;
