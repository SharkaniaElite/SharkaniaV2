-- CANDIDATE ONLY. Not an authorized production migration.
BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='20s';
DO $guard$
BEGIN
 IF (SELECT prosrc FROM pg_proc WHERE oid='public.spend_credits(uuid,text)'::regprocedure) IS DISTINCT FROM $expected_spend$
DECLARE
  v_product shop_products%ROWTYPE;
  v_balance INTEGER;
  v_transaction_id UUID;
  v_purchase_id UUID;
  v_expires_at TIMESTAMPTZ;
  v_existing_purchase user_purchases%ROWTYPE;
BEGIN
  IF (SELECT auth.uid()) IS DISTINCT FROM p_user_id THEN RAISE EXCEPTION 'Acceso denegado a la compra' USING ERRCODE='42501'; END IF;
  -- 1. Obtener producto
  SELECT * INTO v_product
  FROM shop_products
  WHERE slug = p_product_slug AND is_active = true;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'product_not_found');
  END IF;

  -- 2. Para productos temporales/permanentes, verificar si ya tiene acceso vigente
  IF v_product.access_type IN ('daily', 'monthly', 'permanent') THEN
    SELECT * INTO v_existing_purchase
    FROM user_purchases
    WHERE user_id = p_user_id
      AND feature_key = v_product.feature_key
      AND is_active = true
      AND (expires_at IS NULL OR expires_at > NOW())
    LIMIT 1;

    IF FOUND THEN
      RETURN json_build_object(
        'success', false, 
        'error', 'already_active',
        'expires_at', v_existing_purchase.expires_at
      );
    END IF;
  END IF;

  -- 3. Bloquear fila del usuario y verificar balance
  SELECT shark_coins_balance INTO v_balance
  FROM profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF v_balance IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'user_not_found');
  END IF;

  IF v_balance < v_product.price_coins THEN
    RETURN json_build_object(
      'success', false, 
      'error', 'insufficient_balance',
      'balance', v_balance,
      'price', v_product.price_coins
    );
  END IF;

  -- 4. Insertar transacción de gasto (amount negativo)
  --    El trigger on_credit_transaction_insert actualizará el balance
  INSERT INTO credit_transactions (user_id, amount, transaction_type, reference_type, reference_id, description)
  VALUES (
    p_user_id,
    -v_product.price_coins,
    'spend',
    'shop_product',
    v_product.id::TEXT,
    'Compra: ' || v_product.name
  )
  RETURNING id INTO v_transaction_id;

  -- 5. Calcular expiración
  v_expires_at := CASE
    WHEN v_product.access_type = 'permanent' THEN NULL
    WHEN v_product.duration_days IS NOT NULL THEN NOW() + (v_product.duration_days || ' days')::INTERVAL
    ELSE NULL
  END;

  -- 6. Registrar la compra (bypass RLS con SECURITY DEFINER)
  INSERT INTO user_purchases (user_id, product_id, transaction_id, price_paid, access_type, feature_key, expires_at)
  VALUES (
    p_user_id,
    v_product.id,
    v_transaction_id,
    v_product.price_coins,
    v_product.access_type,
    v_product.feature_key,
    v_expires_at
  )
  RETURNING id INTO v_purchase_id;

  -- 7. Retornar éxito
  RETURN json_build_object(
    'success', true,
    'purchase_id', v_purchase_id,
    'transaction_id', v_transaction_id,
    'coins_spent', v_product.price_coins,
    'new_balance', v_balance - v_product.price_coins,
    'feature_key', v_product.feature_key,
    'expires_at', v_expires_at
  );
END;
$expected_spend$
 OR (SELECT prosrc FROM pg_proc WHERE oid='public.use_free_tool(uuid,text)'::regprocedure) IS DISTINCT FROM $expected_free$
DECLARE
    v_last_used DATE;
BEGIN
  IF (SELECT auth.uid()) IS DISTINCT FROM p_user_id THEN RAISE EXCEPTION 'Acceso denegado a herramienta' USING ERRCODE='42501'; END IF;
    -- Buscamos cuándo fue la última vez que usó esta herramienta
    SELECT last_used_date INTO v_last_used
    FROM public.free_tool_usages
    WHERE user_id = p_user_id AND tool_id = p_tool_id;

    -- Si nunca la ha usado, o si la usó en un día anterior a HOY
    IF v_last_used IS NULL OR v_last_used < CURRENT_DATE THEN
        -- Registramos que la acaba de usar hoy (inserta o actualiza)
        INSERT INTO public.free_tool_usages (user_id, tool_id, last_used_date)
        VALUES (p_user_id, p_tool_id, CURRENT_DATE)
        ON CONFLICT (user_id, tool_id)
        DO UPDATE SET last_used_date = CURRENT_DATE;
        
        RETURN TRUE; -- ¡Aprobado! Consumió su uso gratis de hoy
    ELSE
        RETURN FALSE; -- ¡Rechazado! Ya lo usó hoy
    END IF;
END;
$expected_free$
 THEN RAISE EXCEPTION 'STOP: function body drift'; END IF;
 IF EXISTS (SELECT 1 FROM pg_proc WHERE oid IN ('public.spend_credits(uuid,text)'::regprocedure,'public.use_free_tool(uuid,text)'::regprocedure) AND (NOT prosecdef OR proowner <> 'postgres'::regrole OR proconfig IS DISTINCT FROM ARRAY['search_path=public, extensions'] OR has_function_privilege('anon',oid,'EXECUTE') OR NOT has_function_privilege('authenticated',oid,'EXECUTE') OR NOT has_function_privilege('service_role',oid,'EXECUTE') OR EXISTS (SELECT 1 FROM aclexplode(coalesce(proacl,acldefault('f',proowner))) a WHERE grantee=0 OR grantee NOT IN ('postgres'::regrole,'authenticated'::regrole,'service_role'::regrole)))) THEN RAISE EXCEPTION 'STOP: role or configuration drift'; END IF;
 IF md5(pg_get_functiondef('public.update_shark_coins_balance()'::regprocedure)) <> 'd9cda7bfd326fe52fa93ef18dcb9ddd9' THEN RAISE EXCEPTION 'STOP: credit trigger drift'; END IF;
END
$guard$;

CREATE OR REPLACE FUNCTION public.spend_credits(p_user_id uuid, p_product_slug text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_product shop_products%ROWTYPE;
  v_balance INTEGER;
  v_transaction_id UUID;
  v_purchase_id UUID;
  v_expires_at TIMESTAMPTZ;
  v_existing_purchase user_purchases%ROWTYPE;
BEGIN
  IF (SELECT auth.uid()) IS DISTINCT FROM p_user_id THEN RAISE EXCEPTION 'Acceso denegado a la compra' USING ERRCODE='42501'; END IF;
  -- 1. Obtener producto
  SELECT * INTO v_product
  FROM shop_products
  WHERE slug = p_product_slug AND is_active = true;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'product_not_found');
  END IF;

  -- 3. Bloquear fila del usuario y verificar balance
  SELECT shark_coins_balance INTO v_balance
  FROM profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF v_balance IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'user_not_found');
  END IF;

  -- 2. Para productos temporales/permanentes, verificar si ya tiene acceso vigente
  IF v_product.access_type IN ('daily', 'monthly', 'permanent') THEN
    SELECT * INTO v_existing_purchase
    FROM user_purchases
    WHERE user_id = p_user_id
      AND feature_key = v_product.feature_key
      AND is_active = true
      AND (expires_at IS NULL OR expires_at > NOW())
    LIMIT 1;

    IF FOUND THEN
      RETURN json_build_object(
        'success', false, 
        'error', 'already_active',
        'expires_at', v_existing_purchase.expires_at
      );
    END IF;
  END IF;

  IF v_balance < v_product.price_coins THEN
    RETURN json_build_object(
      'success', false, 
      'error', 'insufficient_balance',
      'balance', v_balance,
      'price', v_product.price_coins
    );
  END IF;

  -- 4. Insertar transacción de gasto (amount negativo)
  --    El trigger on_credit_transaction_insert actualizará el balance
  INSERT INTO credit_transactions (user_id, amount, transaction_type, reference_type, reference_id, description)
  VALUES (
    p_user_id,
    -v_product.price_coins,
    'spend',
    'shop_product',
    v_product.id::TEXT,
    'Compra: ' || v_product.name
  )
  RETURNING id INTO v_transaction_id;

  -- 5. Calcular expiración
  v_expires_at := CASE
    WHEN v_product.access_type = 'permanent' THEN NULL
    WHEN v_product.duration_days IS NOT NULL THEN NOW() + (v_product.duration_days || ' days')::INTERVAL
    ELSE NULL
  END;

  -- 6. Registrar la compra (bypass RLS con SECURITY DEFINER)
  INSERT INTO user_purchases (user_id, product_id, transaction_id, price_paid, access_type, feature_key, expires_at)
  VALUES (
    p_user_id,
    v_product.id,
    v_transaction_id,
    v_product.price_coins,
    v_product.access_type,
    v_product.feature_key,
    v_expires_at
  )
  RETURNING id INTO v_purchase_id;

  -- 7. Retornar éxito
  RETURN json_build_object(
    'success', true,
    'purchase_id', v_purchase_id,
    'transaction_id', v_transaction_id,
    'coins_spent', v_product.price_coins,
    'new_balance', v_balance - v_product.price_coins,
    'feature_key', v_product.feature_key,
    'expires_at', v_expires_at
  );
END;
$function$;
CREATE OR REPLACE FUNCTION public.use_free_tool(p_user_id uuid, p_tool_id text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $function$
DECLARE v_allowed boolean;
BEGIN
  IF (SELECT auth.uid()) IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Acceso denegado a herramienta' USING ERRCODE='42501';
  END IF;
  INSERT INTO public.free_tool_usages AS u (user_id,tool_id,last_used_date)
  VALUES (p_user_id,p_tool_id,CURRENT_DATE)
  ON CONFLICT (user_id,tool_id) DO UPDATE SET last_used_date=EXCLUDED.last_used_date
  WHERE u.last_used_date < EXCLUDED.last_used_date
  RETURNING true INTO v_allowed;
  RETURN COALESCE(v_allowed,false);
END;
$function$;
DO $guard$
BEGIN
 IF (SELECT prosrc FROM pg_proc WHERE oid='public.spend_credits(uuid,text)'::regprocedure) IS DISTINCT FROM $expected_spend$
DECLARE
  v_product shop_products%ROWTYPE;
  v_balance INTEGER;
  v_transaction_id UUID;
  v_purchase_id UUID;
  v_expires_at TIMESTAMPTZ;
  v_existing_purchase user_purchases%ROWTYPE;
BEGIN
  IF (SELECT auth.uid()) IS DISTINCT FROM p_user_id THEN RAISE EXCEPTION 'Acceso denegado a la compra' USING ERRCODE='42501'; END IF;
  -- 1. Obtener producto
  SELECT * INTO v_product
  FROM shop_products
  WHERE slug = p_product_slug AND is_active = true;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'product_not_found');
  END IF;

  -- 3. Bloquear fila del usuario y verificar balance
  SELECT shark_coins_balance INTO v_balance
  FROM profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF v_balance IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'user_not_found');
  END IF;

  -- 2. Para productos temporales/permanentes, verificar si ya tiene acceso vigente
  IF v_product.access_type IN ('daily', 'monthly', 'permanent') THEN
    SELECT * INTO v_existing_purchase
    FROM user_purchases
    WHERE user_id = p_user_id
      AND feature_key = v_product.feature_key
      AND is_active = true
      AND (expires_at IS NULL OR expires_at > NOW())
    LIMIT 1;

    IF FOUND THEN
      RETURN json_build_object(
        'success', false, 
        'error', 'already_active',
        'expires_at', v_existing_purchase.expires_at
      );
    END IF;
  END IF;

  IF v_balance < v_product.price_coins THEN
    RETURN json_build_object(
      'success', false, 
      'error', 'insufficient_balance',
      'balance', v_balance,
      'price', v_product.price_coins
    );
  END IF;

  -- 4. Insertar transacción de gasto (amount negativo)
  --    El trigger on_credit_transaction_insert actualizará el balance
  INSERT INTO credit_transactions (user_id, amount, transaction_type, reference_type, reference_id, description)
  VALUES (
    p_user_id,
    -v_product.price_coins,
    'spend',
    'shop_product',
    v_product.id::TEXT,
    'Compra: ' || v_product.name
  )
  RETURNING id INTO v_transaction_id;

  -- 5. Calcular expiración
  v_expires_at := CASE
    WHEN v_product.access_type = 'permanent' THEN NULL
    WHEN v_product.duration_days IS NOT NULL THEN NOW() + (v_product.duration_days || ' days')::INTERVAL
    ELSE NULL
  END;

  -- 6. Registrar la compra (bypass RLS con SECURITY DEFINER)
  INSERT INTO user_purchases (user_id, product_id, transaction_id, price_paid, access_type, feature_key, expires_at)
  VALUES (
    p_user_id,
    v_product.id,
    v_transaction_id,
    v_product.price_coins,
    v_product.access_type,
    v_product.feature_key,
    v_expires_at
  )
  RETURNING id INTO v_purchase_id;

  -- 7. Retornar éxito
  RETURN json_build_object(
    'success', true,
    'purchase_id', v_purchase_id,
    'transaction_id', v_transaction_id,
    'coins_spent', v_product.price_coins,
    'new_balance', v_balance - v_product.price_coins,
    'feature_key', v_product.feature_key,
    'expires_at', v_expires_at
  );
END;
$expected_spend$
 OR (SELECT prosrc FROM pg_proc WHERE oid='public.use_free_tool(uuid,text)'::regprocedure) IS DISTINCT FROM $expected_free$
DECLARE v_allowed boolean;
BEGIN
  IF (SELECT auth.uid()) IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Acceso denegado a herramienta' USING ERRCODE='42501';
  END IF;
  INSERT INTO public.free_tool_usages AS u (user_id,tool_id,last_used_date)
  VALUES (p_user_id,p_tool_id,CURRENT_DATE)
  ON CONFLICT (user_id,tool_id) DO UPDATE SET last_used_date=EXCLUDED.last_used_date
  WHERE u.last_used_date < EXCLUDED.last_used_date
  RETURNING true INTO v_allowed;
  RETURN COALESCE(v_allowed,false);
END;
$expected_free$
 THEN RAISE EXCEPTION 'STOP: function body drift'; END IF;
 IF EXISTS (SELECT 1 FROM pg_proc WHERE oid IN ('public.spend_credits(uuid,text)'::regprocedure,'public.use_free_tool(uuid,text)'::regprocedure) AND (NOT prosecdef OR proowner <> 'postgres'::regrole OR proconfig IS DISTINCT FROM ARRAY['search_path=public, extensions'] OR has_function_privilege('anon',oid,'EXECUTE') OR NOT has_function_privilege('authenticated',oid,'EXECUTE') OR NOT has_function_privilege('service_role',oid,'EXECUTE') OR EXISTS (SELECT 1 FROM aclexplode(coalesce(proacl,acldefault('f',proowner))) a WHERE grantee=0 OR grantee NOT IN ('postgres'::regrole,'authenticated'::regrole,'service_role'::regrole)))) THEN RAISE EXCEPTION 'STOP: role or configuration drift'; END IF;
 IF md5(pg_get_functiondef('public.update_shark_coins_balance()'::regprocedure)) <> 'd9cda7bfd326fe52fa93ef18dcb9ddd9' THEN RAISE EXCEPTION 'STOP: credit trigger drift'; END IF;
END
$guard$;

COMMIT;
