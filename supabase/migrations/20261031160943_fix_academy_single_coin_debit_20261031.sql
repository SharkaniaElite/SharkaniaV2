-- One paid academy unlock must generate exactly one debit.
-- The AFTER INSERT trigger on credit_transactions already adjusts profiles.shark_coins_balance.
-- Previously this RPC also subtracted manually, causing a potential double charge.
-- Existing balances, purchases and player ranking data are not modified by this migration.
CREATE OR REPLACE FUNCTION public.academy_unlock_module(
  p_user_id uuid,
  p_module_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_module RECORD;
  v_balance integer;
BEGIN
  IF (SELECT auth.uid()) IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Acceso denegado al módulo' USING ERRCODE='42501';
  END IF;

  -- Serialize purchases by the same user to prevent parallel overspending.
  PERFORM 1 FROM public.profiles WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'user_not_found');
  END IF;

  SELECT * INTO v_module
  FROM public.academy_modules WHERE id = p_module_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Módulo no encontrado');
  END IF;
  IF v_module.is_active IS DISTINCT FROM true THEN
    RETURN json_build_object('success', false, 'error', 'module_inactive');
  END IF;
  IF v_module.price_coins IS NULL OR v_module.price_coins < 0 THEN
    RETURN json_build_object('success', false, 'error', 'invalid_module_price');
  END IF;

  IF v_module.price_coins = 0 THEN
    INSERT INTO public.academy_user_modules (user_id, module_id)
    VALUES (p_user_id, p_module_id)
    ON CONFLICT (user_id, module_id) DO NOTHING;
    RETURN json_build_object('success', true, 'coins_spent', 0);
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.academy_user_modules
    WHERE user_id = p_user_id AND module_id = p_module_id
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Módulo ya desbloqueado');
  END IF;

  SELECT shark_coins_balance INTO v_balance
  FROM public.profiles WHERE id = p_user_id;
  IF COALESCE(v_balance, 0) < v_module.price_coins THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Shark Coins insuficientes',
      'needed', v_module.price_coins,
      'balance', COALESCE(v_balance, 0)
    );
  END IF;

  -- Single source of truth: this transaction's AFTER INSERT trigger
  -- updates the balance exactly once; do not UPDATE profiles here.
  INSERT INTO public.credit_transactions
    (user_id, amount, transaction_type, reference_type, reference_id, description)
  VALUES
    (p_user_id, -v_module.price_coins, 'spend', 'academy_module',
     p_module_id, 'Desbloqueo: ' || v_module.title);

  INSERT INTO public.academy_user_modules (user_id, module_id)
  VALUES (p_user_id, p_module_id);

  RETURN json_build_object(
    'success', true,
    'coins_spent', v_module.price_coins
  );
END;
$function$;

-- Preserve legitimate authenticated access without granting public anonymous execution.
REVOKE EXECUTE ON FUNCTION public.academy_unlock_module(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.academy_unlock_module(uuid, uuid) TO authenticated, service_role;
