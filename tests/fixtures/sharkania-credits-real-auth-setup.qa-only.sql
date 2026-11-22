-- QA ONLY. Disposable PostgreSQL 17 with synthetic rows; NEVER run on production.
\set ON_ERROR_STOP on
CREATE TABLE public.profiles(id uuid PRIMARY KEY,shark_coins_balance integer NOT NULL);
CREATE TABLE public.shop_products(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),slug text UNIQUE NOT NULL,name text NOT NULL,access_type text NOT NULL,price_coins integer NOT NULL CHECK(price_coins>0),feature_key text NOT NULL,duration_days integer,is_active boolean NOT NULL DEFAULT true);
CREATE TABLE public.credit_transactions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid REFERENCES public.profiles NOT NULL,amount integer NOT NULL,transaction_type text NOT NULL,reference_type text,reference_id text,description text);
CREATE TABLE public.user_purchases(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid REFERENCES public.profiles NOT NULL,product_id uuid REFERENCES public.shop_products NOT NULL,transaction_id uuid REFERENCES public.credit_transactions,price_paid integer NOT NULL,access_type text NOT NULL,feature_key text NOT NULL,expires_at timestamptz,is_active boolean NOT NULL DEFAULT true);
CREATE TABLE public.free_tool_usages(user_id uuid REFERENCES public.profiles NOT NULL,tool_id text NOT NULL,last_used_date date NOT NULL,PRIMARY KEY(user_id,tool_id));
CREATE OR REPLACE FUNCTION public.update_shark_coins_balance()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
BEGIN
    UPDATE public.profiles
    SET shark_coins_balance = shark_coins_balance + NEW.amount
    WHERE id = NEW.user_id;
    RETURN NEW;
END;
$function$;
CREATE TRIGGER on_credit_transaction_insert AFTER INSERT ON public.credit_transactions FOR EACH ROW EXECUTE FUNCTION public.update_shark_coins_balance();
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
$function$;
CREATE OR REPLACE FUNCTION public.use_free_tool(p_user_id uuid, p_tool_id text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
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
$function$;


REVOKE ALL ON FUNCTION public.spend_credits(uuid,text),public.use_free_tool(uuid,text),public.update_shark_coins_balance() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.spend_credits(uuid,text),public.use_free_tool(uuid,text) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.update_shark_coins_balance() TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.free_tool_usages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_purchases ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.credit_transactions,public.free_tool_usages,public.user_purchases TO authenticated;
CREATE POLICY own_credit_read ON public.credit_transactions FOR SELECT USING (auth.uid()=user_id);
CREATE POLICY own_usage_read ON public.free_tool_usages FOR SELECT USING (auth.uid()=user_id);
CREATE POLICY own_purchase_read ON public.user_purchases FOR SELECT USING (auth.uid()=user_id);
CREATE POLICY deny_purchase_insert ON public.user_purchases FOR INSERT WITH CHECK(false);
INSERT INTO shop_products(slug,name,access_type,price_coins,feature_key,duration_days) VALUES ('qa-month','Synthetic access','monthly',10,'qa_feature',30),('qa-use','Synthetic usage','per_use',5,'qa_per_use',NULL);
NOTIFY pgrst, 'reload schema';
