
-- Reemplazar la política de DELETE de leagues para incluir club admins
DROP POLICY IF EXISTS "Leagues: super eliminar" ON leagues;

CREATE POLICY "Leagues: admin o super eliminar"
  ON leagues FOR DELETE
  USING (
    is_super_admin() 
    OR (EXISTS (
      SELECT 1 FROM league_clubs lc
      JOIN club_admins ca ON ca.club_id = lc.club_id
      WHERE lc.league_id = leagues.id AND ca.user_id = auth.uid()
    ))
  );
