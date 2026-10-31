-- Decommission Lemon Squeezy real-money top-ups.
-- The upstream Edge Function is already inert (HTTP 410, JWT required).
-- This orphaned service-only RPC credited currency from legacy order IDs.
-- No historical purchase/order transactions exist as of the retirement audit.
-- Preserve credit_transactions, the balance trigger, spend_credits and academy purchases:
-- they are required for earned Shark Coins, XP and virtual shop unlocks.
DROP FUNCTION IF EXISTS public.add_credits_to_user(uuid, integer, text);
