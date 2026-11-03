\set ON_ERROR_STOP on
-- Load the EXACT proposal under test; no pasted duplicate policy expressions.
\ir ../../docs/security/sharkania-non-sharktv-rls-hardening-2026-11-03.proposal.sql

-- Anonymous sessions must never mutate data, even if granted DML at table level.
SET ROLE anon;
RESET request.jwt.claim.sub;
SELECT public.qa_expect_dml('anon cannot associate clubs',
'INSERT INTO public.tournament_clubs VALUES (''00000000-0000-0000-0000-000000000011'',''00000000-0000-0000-0000-000000000022'',false)',false);
SELECT public.qa_expect_dml('anon cannot remove club',
'DELETE FROM public.tournament_clubs WHERE tournament_id=''00000000-0000-0000-0000-000000000011''',false);
SELECT public.qa_expect_dml('anon cannot add payout',
'INSERT INTO public.acc_payouts VALUES (''00000000-0000-0000-0000-000000000041'',500)',false);
SELECT public.qa_expect_dml('anon cannot change config',
'UPDATE public.site_configs SET value=''hacked'' WHERE key=''global''',false);

-- Signed-in regular player is not a club/finance/site admin.
SET ROLE authenticated;
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000003';
SELECT public.qa_expect_dml('player cannot associate clubs',
'INSERT INTO public.tournament_clubs VALUES (''00000000-0000-0000-0000-000000000011'',''00000000-0000-0000-0000-000000000022'',false)',false);
SELECT public.qa_expect_dml('player cannot add payout',
'INSERT INTO public.acc_payouts VALUES (''00000000-0000-0000-0000-000000000042'',500)',false);
SELECT public.qa_expect_dml('player cannot delete payout',
'DELETE FROM public.acc_payouts WHERE id=''00000000-0000-0000-0000-000000000031''',false);
SELECT public.qa_expect_dml('player cannot change promo config',
'INSERT INTO public.acc_player_promo_config VALUES (''fakeplayer'',true)',false);
SELECT public.qa_expect_dml('player cannot add promo payment',
'INSERT INTO public.acc_player_promo_payouts VALUES (''00000000-0000-0000-0000-000000000043'',500)',false);
SELECT public.qa_expect_dml('player cannot update site config',
'UPDATE public.site_configs SET value=''hacked'' WHERE key=''global''',false);
SELECT public.qa_expect_dml('player cannot add poll',
'INSERT INTO public.live_polls VALUES (''00000000-0000-0000-0000-000000000044'',''hacked?'')',false);
SELECT public.qa_expect_dml('player cannot change embeddings',
'UPDATE public.blog_embeddings SET content=''hacked'' WHERE id=''00000000-0000-0000-0000-000000000033''',false);

-- Authorized admin of club A can manage only tournaments belonging to A.
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
SELECT public.qa_expect_dml('club A admin can associate own tournament',
'INSERT INTO public.tournament_clubs VALUES (''00000000-0000-0000-0000-000000000011'',''00000000-0000-0000-0000-000000000022'',false)',true);
SELECT public.qa_expect_dml('club A admin cannot associate other tournament',
'INSERT INTO public.tournament_clubs VALUES (''00000000-0000-0000-0000-000000000012'',''00000000-0000-0000-0000-000000000021'',false)',false);
SELECT public.qa_expect_dml('club A admin can update own association',
'UPDATE public.tournament_clubs SET is_primary=true WHERE tournament_id=''00000000-0000-0000-0000-000000000011'' AND club_id=''00000000-0000-0000-0000-000000000022''',true);
SELECT public.qa_expect_dml('club A admin cannot delete club B association',
'DELETE FROM public.tournament_clubs WHERE tournament_id=''00000000-0000-0000-0000-000000000012''',false);
SELECT public.qa_expect_dml('club A admin cannot change payouts',
'UPDATE public.acc_payouts SET amount=999 WHERE id=''00000000-0000-0000-0000-000000000031''',false);

-- Finance manager may manage accounting only.
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000004';
SELECT public.qa_expect_dml('finance manager may create payout',
'INSERT INTO public.acc_payouts VALUES (''00000000-0000-0000-0000-000000000045'',500)',true);
SELECT public.qa_expect_dml('finance manager may set promo config',
'INSERT INTO public.acc_player_promo_config VALUES (''fakefinance'',true)',true);
SELECT public.qa_expect_dml('finance manager may record promo payout',
'INSERT INTO public.acc_player_promo_payouts VALUES (''00000000-0000-0000-0000-000000000046'',500)',true);
SELECT public.qa_expect_dml('finance manager cannot edit site config',
'UPDATE public.site_configs SET value=''hacked'' WHERE key=''global''',false);

-- Superadmin may perform privileged operations across all covered domains.
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
SELECT public.qa_expect_dml('superadmin may associate clubs',
'INSERT INTO public.tournament_clubs VALUES (''00000000-0000-0000-0000-000000000012'',''00000000-0000-0000-0000-000000000021'',false)',true);
SELECT public.qa_expect_dml('superadmin may modify site configs',
'UPDATE public.site_configs SET value=''enabled-v2'' WHERE key=''global''',true);
SELECT public.qa_expect_dml('superadmin may create polls',
'INSERT INTO public.live_polls VALUES (''00000000-0000-0000-0000-000000000047'',''legitimate?'')',true);
SELECT public.qa_expect_dml('superadmin may modify embeddings',
'UPDATE public.blog_embeddings SET content=''updated'' WHERE id=''00000000-0000-0000-0000-000000000033''',true);
SELECT public.qa_expect_dml('superadmin may create payout',
'INSERT INTO public.acc_payouts VALUES (''00000000-0000-0000-0000-000000000048'',100)',true);
RESET ROLE;
SELECT 'PASS: isolated permissions test (no production connection or user data)' AS outcome;
