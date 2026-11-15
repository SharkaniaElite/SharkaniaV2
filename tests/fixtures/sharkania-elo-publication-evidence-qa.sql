\set ON_ERROR_STOP on
-- Disposable qa_league_atomic database, synthetic UUIDs and profiles.
-- Appending event + pre-event stats must be one transaction with the actual
-- guarded writer in the eventual production design (NOT included here).
BEGIN;
\ir ../../docs/security/league-elo-publication-evidence-2026-11-06.qa-only.sql

INSERT INTO sharkania_release_qa.elo_publication(
 id,tournament_id,league_id,actor_profile_id,algorithm_version,input_fingerprint)
VALUES (
 '00000000-0000-0000-0000-000000000081',
 '00000000-0000-0000-0000-000000000071',
 '00000000-0000-0000-0000-000000000041',
 '00000000-0000-0000-0000-000000000002',
 'legacy-js-v1',
 repeat('a',64)
);
INSERT INTO sharkania_release_qa.elo_player_checkpoint(
 publication_id,player_id,elo_before,elo_after,elo_peak_before,
 tournaments_before,cashes_before,wins_before,prize_won_before,
 buy_ins_before,elo_change)
VALUES (
 '00000000-0000-0000-0000-000000000081',
 '00000000-0000-0000-0000-000000000051',
 1200,1222.23,1200,0,0,0,0,0,22.23
);
DO $qa$
BEGIN
 IF (SELECT count(*) FROM sharkania_release_qa.elo_player_checkpoint)<>1
 THEN RAISE EXCEPTION 'FAIL: checkpoint not inserted'; END IF;
 BEGIN
  UPDATE sharkania_release_qa.elo_player_checkpoint
   SET elo_after=1300 WHERE player_id='00000000-0000-0000-0000-000000000051';
  RAISE EXCEPTION 'FAIL: old snapshot overwritten';
 EXCEPTION WHEN SQLSTATE 'PT409' THEN
  RAISE NOTICE 'PASS: baseline snapshot is immutable';
 END;
 BEGIN
  DELETE FROM sharkania_release_qa.elo_publication;
  RAISE EXCEPTION 'FAIL: event deleted';
 EXCEPTION WHEN SQLSTATE 'PT409' THEN
  RAISE NOTICE 'PASS: publication event is immutable';
 END;
 IF has_table_privilege('authenticated'::name,
    'sharkania_release_qa.elo_player_checkpoint','INSERT') OR
    has_table_privilege('anon'::name,
    'sharkania_release_qa.elo_publication','SELECT') OR
    has_schema_privilege('authenticated'::name,'sharkania_release_qa','USAGE')
 THEN RAISE EXCEPTION 'FAIL: browser roles can read/write private event evidence'; END IF;
 RAISE NOTICE 'PASS: no public/client table or schema grants';
END $qa$;

-- An invalid checkpoint must roll back both the new publication event and
-- the checkpoint inside a nested SQL exception subtransaction.
DO $qa$
BEGIN
 BEGIN
  INSERT INTO sharkania_release_qa.elo_publication(
   id,tournament_id,league_id,actor_profile_id,algorithm_version,input_fingerprint)
  VALUES (
   '00000000-0000-0000-0000-000000000082',
   '00000000-0000-0000-0000-000000000011',
   '00000000-0000-0000-0000-000000000041',
   '00000000-0000-0000-0000-000000000002',
   'legacy-js-v1',repeat('b',64)
  );
  INSERT INTO sharkania_release_qa.elo_player_checkpoint(
   publication_id,player_id,elo_before,elo_after,elo_peak_before,
   tournaments_before,cashes_before,wins_before,prize_won_before,
   buy_ins_before,elo_change)
  VALUES (
   '00000000-0000-0000-0000-000000000082',
   '00000000-0000-0000-0000-000000000052',
    1200,1210,1200,-1,0,0,0,0,10
  );
  RAISE EXCEPTION 'FAIL: invalid baseline stats accepted';
 EXCEPTION WHEN check_violation THEN
  RAISE NOTICE 'PASS: invalid baseline rejected with event rolled back';
 END;
 IF EXISTS(SELECT 1 FROM sharkania_release_qa.elo_publication WHERE
   id='00000000-0000-0000-0000-000000000082') THEN
  RAISE EXCEPTION 'FAIL: failed transaction left orphan publication event';
 END IF;
 RAISE NOTICE 'PASS: no partial event survived failed checkpoint';
END $qa$;
ROLLBACK;

DO $qa$
BEGIN
 IF to_regclass('sharkania_release_qa.elo_publication') IS NOT NULL
 OR to_regclass('sharkania_release_qa.elo_player_checkpoint') IS NOT NULL
 THEN RAISE EXCEPTION 'FAIL: QA ledger schema not fully rolled back'; END IF;
 RAISE NOTICE 'PASS FINAL: append-only publication evidence tests were fully rolled back';
END $qa$;
