
-- Permitir que un club admin pueda actualizar jugadores que participaron en torneos de su club
CREATE POLICY "Players: club admin editar jugadores de su club" ON players
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM tournament_results tr
    JOIN tournaments t ON t.id = tr.tournament_id
    JOIN club_admins ca ON ca.club_id = t.club_id
    WHERE tr.player_id = players.id
    AND ca.user_id = auth.uid()
  )
);
