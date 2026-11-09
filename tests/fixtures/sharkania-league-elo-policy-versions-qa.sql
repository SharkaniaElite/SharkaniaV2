\set ON_ERROR_STOP on
-- QA-only: independent SQL checks against the current deployed JS formula
-- and a DISTINCT, NOT APPROVED currency-neutral Elo candidate. No writes.
DO $qa$
DECLARE
  v_legacy jsonb;
  v_neutral_usd jsonb;
  v_neutral_eur jsonb;
  v_neutral_clp jsonb;
  v_neutral_b jsonb;
  v_failed boolean;
BEGIN
  v_legacy:=sharkania_release_qa.quote_elo_policy_qa(
    'legacy-js-v1','USD',3.30,1200,0,1,
    ARRAY[1200,1200]::numeric[]
  );
  IF v_legacy->>'elo_after'<>'1222.23'
    OR v_legacy->>'elo_change'<>'22.23'
    OR v_legacy->>'k'<>'44.454470'
    OR v_legacy->>'currency'<>'USD'
  THEN
    RAISE EXCEPTION 'FAIL: legacy v1 initial USD ELO differs from frontend';
  END IF;

  -- The v2 CANDIDATE intentionally has no nominal buy-in multiplier.
  v_neutral_usd:=sharkania_release_qa.quote_elo_policy_qa(
    'currency-neutral-v2-PROPOSAL','USD',3.30,1200,0,1,
    ARRAY[1200,1200]::numeric[]
  );
  v_neutral_eur:=sharkania_release_qa.quote_elo_policy_qa(
    'currency-neutral-v2-PROPOSAL','EUR',12,1200,0,1,
    ARRAY[1200,1200]::numeric[]
  );
  v_neutral_clp:=sharkania_release_qa.quote_elo_policy_qa(
    'currency-neutral-v2-PROPOSAL','CLP',3300,1200,0,1,
    ARRAY[1200,1200]::numeric[]
  );
  IF v_neutral_usd->>'elo_after'<>'1220.90'
    OR v_neutral_usd->>'elo_change'<>'20.90'
    OR v_neutral_usd->>'k'<>'41.806180'
    OR v_neutral_usd->>'approval_status'<>'QA_PROPOSAL_NOT_ACTIVE'
    OR v_neutral_usd->>'buy_in_affects_elo'<>'false'
    OR v_neutral_usd->>'algorithm_version'<>'currency-neutral-v2-PROPOSAL'
    OR v_neutral_eur->>'elo_change' IS DISTINCT FROM
       v_neutral_clp->>'elo_change'
    OR v_neutral_eur->>'elo_after' IS DISTINCT FROM
       v_neutral_usd->>'elo_after'
    OR v_neutral_clp->>'k' IS DISTINCT FROM v_neutral_usd->>'k'
  THEN
    RAISE EXCEPTION 'FAIL: v2-proposal depends on currency or nominal entry: %',
      v_neutral_usd;
  END IF;
  RAISE NOTICE 'PASS: USD/EUR/CLP proposed v2 has equal ELO with different nominal buy-ins';

  -- The historical v1 algorithm is intentionally NOT currency neutral.
  v_neutral_b:=sharkania_release_qa.quote_elo_policy_qa(
    'legacy-js-v1','CLP',3300,1200,0,1,
    ARRAY[1200,1200]::numeric[]
  );
  IF v_neutral_b->>'elo_after'<>'1228.26' THEN
    RAISE EXCEPTION 'FAIL: historical buy-in multiplier was silently removed';
  END IF;

  -- 3-player case from previous fixture; 29/30/31 tournament threshold,
  -- including two ratings above/below 1200 and negative results.
  IF (sharkania_release_qa.quote_elo_policy_qa(
    'legacy-js-v1','USD',3.30,1200,29,1,
    ARRAY[1200,1400,1000]::numeric[]))->>'elo_after'<>'1222.79'
    OR (sharkania_release_qa.quote_elo_policy_qa(
      'legacy-js-v1','USD',3.30,1400,30,2,
      ARRAY[1200,1400,1000]::numeric[]))->>'elo_after'<>'1392.05'
    OR (sharkania_release_qa.quote_elo_policy_qa(
      'legacy-js-v1','USD',3.30,1000,31,3,
      ARRAY[1200,1400,1000]::numeric[]))->>'elo_after'<>'996.56'
    OR (sharkania_release_qa.quote_elo_policy_qa(
      'currency-neutral-v2-PROPOSAL','EUR',12,1400,30,2,
      ARRAY[1200,1400,1000]::numeric[]))->>'elo_after'<>'1392.52'
  THEN RAISE EXCEPTION 'FAIL: 3-player 29/30 Elo fixture differs'; END IF;

  v_failed:=false;
  BEGIN
    PERFORM sharkania_release_qa.quote_elo_policy_qa(
      'currency-neutral-v2','USD',3.3,1200,0,1,
      ARRAY[1200,1200]::numeric[]
    );
  EXCEPTION WHEN SQLSTATE 'PT422' THEN v_failed:=true; END;
  IF NOT v_failed THEN RAISE EXCEPTION 'FAIL: unreviewed algorithm accepted'; END IF;

  v_failed:=false;
  BEGIN
    PERFORM sharkania_release_qa.quote_elo_policy_qa(
      'currency-neutral-v2-PROPOSAL','JPY',100,1200,0,1,
      ARRAY[1200,1200]::numeric[]
    );
  EXCEPTION WHEN SQLSTATE 'PT422' THEN v_failed:=true; END;
  IF NOT v_failed THEN RAISE EXCEPTION 'FAIL: unreviewed currency accepted'; END IF;

  IF pg_catalog.has_function_privilege('anon',
     'sharkania_release_qa.quote_elo_policy_qa(text,text,numeric,numeric,integer,integer,numeric[])',
     'EXECUTE')
  OR pg_catalog.has_function_privilege('authenticated',
     'sharkania_release_qa.quote_elo_policy_qa(text,text,numeric,numeric,integer,integer,numeric[])',
     'EXECUTE')
  THEN RAISE EXCEPTION 'FAIL: proposed calculator exposed to API roles'; END IF;

  RAISE NOTICE 'PASS: legacy v1 parity and private v2 candidate calculator';
END;
$qa$;
