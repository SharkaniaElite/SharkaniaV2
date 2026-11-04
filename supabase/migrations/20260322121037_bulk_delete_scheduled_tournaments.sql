
-- Función para eliminar torneos scheduled en lote
-- Solo elimina torneos con status 'scheduled' (sin resultados, seguros de borrar)
CREATE OR REPLACE FUNCTION bulk_delete_scheduled_tournaments(
  p_tournament_ids uuid[]
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count integer;
BEGIN
  DELETE FROM tournaments
  WHERE id = ANY(p_tournament_ids)
  AND status = 'scheduled'
  AND results_uploaded = false;
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
