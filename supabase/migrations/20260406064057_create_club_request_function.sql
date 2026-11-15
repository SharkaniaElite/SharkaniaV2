
-- Función para crear solicitud de club sin necesidad de sesión activa
-- Se ejecuta con SECURITY DEFINER (permisos del creador, no del caller)
CREATE OR REPLACE FUNCTION create_club_registration_request(
  p_user_id UUID,
  p_club_name TEXT,
  p_country_code TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_whatsapp TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO club_registration_requests (user_id, club_name, country_code, description, whatsapp)
  VALUES (p_user_id, p_club_name, p_country_code, p_description, p_whatsapp)
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Permitir que anon y authenticated llamen esta función
GRANT EXECUTE ON FUNCTION create_club_registration_request(UUID, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;
