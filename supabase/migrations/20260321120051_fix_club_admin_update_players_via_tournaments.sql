
-- Agregar policy más permisiva: club admin puede actualizar CUALQUIER player
-- que existe en un torneo de su club (usando tournaments directamente)
CREATE POLICY "Players: club admin update via tournament ownership" ON players
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM tournaments t
    JOIN club_admins ca ON ca.club_id = t.club_id
    WHERE ca.user_id = auth.uid()
    AND t.id IN (
      SELECT tournament_id FROM tournament_results WHERE player_id = players.id
    )
  )
);
