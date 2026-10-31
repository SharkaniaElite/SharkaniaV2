-- Private view event data must never be readable or writable by browser roles.
ALTER TABLE private.hand_view_cooldowns ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE private.hand_view_cooldowns FROM PUBLIC, anon, authenticated;
