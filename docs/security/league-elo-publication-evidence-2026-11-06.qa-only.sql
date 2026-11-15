-- SHARKANIA · QA-ONLY append-only publication evidence store.
-- NOT A MIGRATION. DO NOT EXECUTE AGAINST PRODUCTION.
-- This supplies a future audit contract, not a trustworthy ledger for prior
-- events. The future guarded writer must append its checkpoints in the SAME
-- transaction as results/ELO and coordinate commit order across all writers.
CREATE SCHEMA IF NOT EXISTS sharkania_release_qa;
REVOKE ALL ON SCHEMA sharkania_release_qa FROM PUBLIC, anon, authenticated;

CREATE TABLE sharkania_release_qa.elo_publication (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tournament_id uuid NOT NULL REFERENCES public.tournaments(id),
 league_id uuid NOT NULL REFERENCES public.leagues(id),
 actor_profile_id uuid NOT NULL,
 algorithm_version text NOT NULL CHECK (length(algorithm_version) BETWEEN 3 AND 80),
 input_fingerprint text NOT NULL CHECK(input_fingerprint ~ '^[a-f0-9]{64}$'),
 created_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
 UNIQUE(tournament_id)
);
CREATE TABLE sharkania_release_qa.elo_player_checkpoint (
 publication_id uuid NOT NULL REFERENCES sharkania_release_qa.elo_publication(id),
 player_id uuid NOT NULL REFERENCES public.players(id),
 elo_before numeric NOT NULL CHECK(elo_before>=100),
 elo_after numeric NOT NULL CHECK(elo_after>=100),
 elo_peak_before numeric NOT NULL CHECK(elo_peak_before>=elo_before),
 tournaments_before integer NOT NULL CHECK(tournaments_before>=0),
 cashes_before integer NOT NULL CHECK(cashes_before>=0),
 wins_before integer NOT NULL CHECK(wins_before>=0),
 prize_won_before numeric NOT NULL CHECK(prize_won_before>=0),
 buy_ins_before numeric NOT NULL CHECK(buy_ins_before>=0),
 elo_change numeric NOT NULL,
 PRIMARY KEY (publication_id,player_id),
 CHECK (cashes_before<=tournaments_before),
 CHECK (wins_before<=tournaments_before)
);
-- Immutable records: corrections must append a new explicitly versioned
-- event to a redesigned ledger, never overwrite an old checkpoint.
CREATE OR REPLACE FUNCTION sharkania_release_qa.reject_publication_mutation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $reject$
BEGIN
 RAISE EXCEPTION 'Publication evidence is immutable; append correction evidence'
   USING ERRCODE='PT409';
END;
$reject$;
REVOKE ALL ON FUNCTION sharkania_release_qa.reject_publication_mutation()
FROM PUBLIC,anon,authenticated;

CREATE TRIGGER qa_immutable_elo_publication
BEFORE UPDATE OR DELETE ON sharkania_release_qa.elo_publication
FOR EACH ROW EXECUTE FUNCTION sharkania_release_qa.reject_publication_mutation();

CREATE TRIGGER qa_immutable_elo_checkpoint
BEFORE UPDATE OR DELETE ON sharkania_release_qa.elo_player_checkpoint
FOR EACH ROW EXECUTE FUNCTION sharkania_release_qa.reject_publication_mutation();

ALTER TABLE sharkania_release_qa.elo_publication ENABLE ROW LEVEL SECURITY;
ALTER TABLE sharkania_release_qa.elo_player_checkpoint ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA sharkania_release_qa FROM PUBLIC,anon,authenticated;
-- No grants and NO data API exposure for client roles in this QA prototype.
