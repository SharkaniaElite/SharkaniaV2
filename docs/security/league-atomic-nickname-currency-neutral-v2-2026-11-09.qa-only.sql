-- QA-ONLY PROPOSAL. Not an authorized Elo change or deployable migration.
-- QA PROTOTYPE ONLY: atomic nickname resolution + initial league results
-- + private immutable currency-tagged posting. NOT A MIGRATION.
-- NEVER deploy to production or use a Pages preview against production.
-- Dependency: guarded league ACL, guarded initial USD writer, private audit
-- schema and a UNIQUE (room_id, lower(btrim(nickname))) index.
CREATE OR REPLACE FUNCTION public.publish_league_nickname_results_v2_qa(
  p_tournament_id uuid,
  p_results jsonb
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $guarded$
DECLARE
  v_club uuid;
  v_league uuid;
  v_room uuid;
  v_currency text;
  v_buyin numeric;
  v_country text;
  v_primary uuid;
  v_primary_count integer;
  v_rows integer;
  v_invalid integer;
  v_distinct_nicks integer;
  v_distinct_positions integer;
  v_min_position integer;
  v_max_position integer;
  v_nick text;
  v_new_players integer;
  v_resolved_count integer;
  v_resolved jsonb;
  v_pub_id uuid;
  v_postings integer;
  v_result jsonb;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501';
  END IF;

  IF p_tournament_id IS NULL
    OR p_results IS NULL OR pg_catalog.jsonb_typeof(p_results)<>'array'
    OR pg_catalog.jsonb_array_length(p_results) NOT BETWEEN 2 AND 1000
  THEN RAISE EXCEPTION 'Expected 2 to 1000 nickname results'
    USING ERRCODE='PT422'; END IF;

  -- Lock order agrees with the inner guarded writer: tournament then league.
  SELECT t.club_id,t.league_id,t.room_id,t.currency,t.buy_in,
         c.country_code
    INTO v_club,v_league,v_room,v_currency,v_buyin,v_country
  FROM public.tournaments t
  LEFT JOIN public.clubs c ON c.id=t.club_id
  WHERE t.id=p_tournament_id FOR UPDATE OF t;

  IF NOT FOUND THEN RAISE EXCEPTION 'Tournament not found'
    USING ERRCODE='PT404'; END IF;
  IF v_league IS NULL THEN
    RAISE EXCEPTION 'Only league tournaments are supported'
      USING ERRCODE='PT422'; END IF;

  PERFORM 1 FROM public.leagues WHERE id=v_league FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'League not found'
    USING ERRCODE='PT404'; END IF;

  SELECT count(*)::int,(array_agg(lc.club_id))[1]
    INTO v_primary_count,v_primary
  FROM public.league_clubs lc
  WHERE lc.league_id=v_league AND lc.is_primary IS TRUE;
  IF v_primary_count<>1 OR v_primary IS DISTINCT FROM v_club THEN
    RAISE EXCEPTION 'Only the primary organizer tournament may publish'
      USING ERRCODE='42501'; END IF;
  IF NOT ((SELECT public.is_super_admin()) OR
          (SELECT public.is_club_admin(v_primary))) THEN
    RAISE EXCEPTION 'Only the primary organizer may publish'
      USING ERRCODE='42501'; END IF;

  -- Currency is a SERVER-side tournament attribute. Do not accept an
  -- untrusted currency or conversion rate from the CSV.
  -- Multi-currency postings are modeled below, but *publishing* non-USD
  -- remains blocked until currency/Elo semantics are approved and tested.
  IF v_currency IS NULL OR v_currency NOT IN ('USD','EUR','CLP') THEN
    RAISE EXCEPTION 'Unsupported currency for future v2 QA candidate'
      USING ERRCODE='PT409'; END IF;

  IF EXISTS (
    SELECT 1 FROM pg_catalog.jsonb_array_elements(p_results) AS item(value)
    WHERE pg_catalog.jsonb_typeof(item.value)<>'object'
      OR pg_catalog.jsonb_typeof(item.value->'nickname')<>'string'
      OR item.value ? 'player_id'
  ) THEN RAISE EXCEPTION 'Expected nickname objects without client player IDs'
    USING ERRCODE='PT422'; END IF;

  WITH input AS (
    SELECT * FROM pg_catalog.jsonb_to_recordset(p_results)
      AS x(nickname text,position integer,prize_won numeric,
           bounties_won numeric,league_points_earned numeric,
           ccp_club text,buy_ins_count numeric)
  )
  SELECT count(*)::int,
         count(DISTINCT pg_catalog.lower(pg_catalog.btrim(nickname)))::int,
         count(DISTINCT position)::int,min(position),max(position),
         count(*) FILTER (
           WHERE nickname IS NULL
              OR length(pg_catalog.btrim(nickname)) NOT BETWEEN 1 AND 80
              OR position IS NULL OR position<=0
              OR prize_won IS NULL OR prize_won<0
              OR bounties_won IS NULL OR bounties_won<0
              OR league_points_earned IS NULL OR league_points_earned<0
              OR buy_ins_count IS NULL OR buy_ins_count NOT BETWEEN 1 AND 100
              OR buy_ins_count<>trunc(buy_ins_count)
              OR length(coalesce(ccp_club,''))>120
         )::int
  INTO v_rows,v_distinct_nicks,v_distinct_positions,
       v_min_position,v_max_position,v_invalid
  FROM input;
  IF v_invalid<>0 OR v_distinct_nicks<>v_rows OR
     v_distinct_positions<>v_rows OR v_min_position<>1 OR
     v_max_position<>v_rows THEN
    RAISE EXCEPTION 'Invalid, duplicate or nonconsecutive nickname results'
      USING ERRCODE='PT422'; END IF;

  -- Contract: this unique expression index is mandatory. A legacy
  -- case-sensitive UNIQUE(nickname,room_id) alone is NOT sufficient.
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_index i
    JOIN pg_catalog.pg_class ix ON ix.oid=i.indexrelid
    WHERE i.indrelid='public.players'::regclass
      AND ix.relname='qa_players_normalized_nickname_room'
      AND i.indisunique AND i.indisvalid AND i.indisready
  ) THEN
    RAISE EXCEPTION 'Normalized player identity uniqueness is not enforced'
      USING ERRCODE='PT409'; END IF;

  -- Serialise normalized nicknames per room, acquired in stable order to
  -- avoid in-RPC slug/alias races; the unique expression index is final
  -- integrity enforcement. All old direct player writers must be closed
  -- or subject to the same index at production cutover.
  FOR v_nick IN
    SELECT DISTINCT pg_catalog.lower(pg_catalog.btrim(x.nickname)) AS normalized
    FROM pg_catalog.jsonb_to_recordset(p_results) AS x(nickname text)
    ORDER BY normalized
  LOOP
    PERFORM pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended('league-player:'||v_room::text||':'||v_nick,0)
    );
  END LOOP;

  INSERT INTO public.players(nickname,room_id,country_code,elo_rating,elo_peak)
  SELECT pg_catalog.btrim(x.nickname),v_room,v_country,1200,1200
  FROM pg_catalog.jsonb_to_recordset(p_results) AS x(nickname text)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.players p
    WHERE p.room_id=v_room
      AND pg_catalog.lower(pg_catalog.btrim(p.nickname))=
          pg_catalog.lower(pg_catalog.btrim(x.nickname))
  )
  ORDER BY pg_catalog.lower(pg_catalog.btrim(x.nickname))
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_new_players = ROW_COUNT;

  -- Construct a trusted, typed payload from the DB player IDs; never
  -- trust an incoming player_id or allow CSV nickname to link a profile.
  WITH input AS (
    SELECT * FROM pg_catalog.jsonb_to_recordset(p_results)
      AS x(nickname text,position integer,prize_won numeric,
           bounties_won numeric,league_points_earned numeric,
           ccp_club text,buy_ins_count numeric)
  ), resolved AS (
    SELECT x.*, p.id AS resolved_id
    FROM input x
    JOIN public.players p ON p.room_id=v_room
      AND pg_catalog.lower(pg_catalog.btrim(p.nickname))=
          pg_catalog.lower(pg_catalog.btrim(x.nickname))
  )
  SELECT count(*)::int,
         pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
           'player_id',resolved_id,'position',position,
           'prize_won',prize_won,'bounties_won',bounties_won,
           'league_points_earned',league_points_earned,
           'ccp_club',ccp_club,'buy_ins_count',buy_ins_count
         ) ORDER BY position)
    INTO v_resolved_count,v_resolved
  FROM resolved;
  IF v_resolved_count<>v_rows OR
     (SELECT count(DISTINCT x.player_id)
      FROM pg_catalog.jsonb_to_recordset(v_resolved)
        AS x(player_id uuid))<>v_rows THEN
    RAISE EXCEPTION 'Nickname resolution incomplete or ambiguous'
      USING ERRCODE='PT409'; END IF;

  -- The inner writer stores results, Elo, standings and audit in this same
  -- PostgREST transaction. Any error below rolls back new players too.
  v_result := public.publish_league_results_v2_qa(
    p_tournament_id,'upload',v_resolved
  );

  SELECT p.id INTO v_pub_id
  FROM sharkania_release_qa.elo_publication p
  WHERE p.tournament_id=p_tournament_id;
  IF v_pub_id IS NULL THEN
    RAISE EXCEPTION 'Required publication audit missing'
      USING ERRCODE='PT409'; END IF;

  -- Per-player native-currency facts, with true buy-in count.
  -- Never aggregate distinct currencies into players' legacy totals.
  INSERT INTO sharkania_release_qa.currency_posting(
    publication_id,tournament_id,player_id,currency,
    buy_in_per_entry,buy_ins_count,prize_won,bounties_won
  )
  SELECT v_pub_id,p_tournament_id,x.player_id,v_currency,
         v_buyin,x.buy_ins_count::integer,x.prize_won,x.bounties_won
  FROM pg_catalog.jsonb_to_recordset(v_resolved) AS x(
    player_id uuid,buy_ins_count numeric,prize_won numeric,bounties_won numeric
  );
  GET DIAGNOSTICS v_postings = ROW_COUNT;
  IF v_postings<>v_rows THEN
    RAISE EXCEPTION 'Incomplete currency journal coverage'
      USING ERRCODE='PT409'; END IF;

  RETURN v_result || pg_catalog.jsonb_build_object(
    'new_players',v_new_players,'currency',v_currency,
    'currency_postings',v_postings,'normalized_nicknames',true
  );
END;
$guarded$;
REVOKE EXECUTE ON FUNCTION public.publish_league_nickname_results_v2_qa(uuid,jsonb)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.publish_league_nickname_results_v2_qa(uuid,jsonb)
  TO authenticated;
