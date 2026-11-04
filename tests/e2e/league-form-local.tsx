/**
 * DEV-ONLY league form harness using the real React component.
 *
 * This HTML is not a Vite build input (only available through vite dev).
 * No service role key, no real data, and no Supabase production endpoint.
 * To test the complete admin portal, use the actual /club-admin route.
 */
import React, { useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LeagueForm } from "../../src/components/admin/league-form";
import { GUARDED_LEAGUE_RPC_ENABLED } from "../../src/lib/api/guarded-leagues";
import { supabase } from "../../src/lib/supabase";
import type { League } from "../../src/types";
import "../../src/index.css";

const BACKEND = String(import.meta.env.VITE_SUPABASE_URL ?? "");
const SAFE_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1):\d+\/?$/i.test(BACKEND);
const SAFE_HOST = ["localhost", "127.0.0.1"].includes(window.location.hostname);
const ALLOWED = import.meta.env.DEV && SAFE_HOST && SAFE_ORIGIN && GUARDED_LEAGUE_RPC_ENABLED;

// Keep the selected club (the view) separate from the league's actual
// primary organizer (the authority). Secondary clubs can view a league but
// cannot reassign its organizer during a guarded edit.
type QaLeague = League & {
  primary_club_id: string | null;
  is_primary_for_club: boolean;
};

function Harness() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [clubs, setClubs] = useState<{ id: string; name: string }[]>([]);
  const [clubId, setClubId] = useState("");
  const [leagues, setLeagues] = useState<QaLeague[]>([]);
  const [edit, setEdit] = useState<QaLeague | null | undefined>(undefined);
  const [notice, setNotice] = useState("");
  const [refresh, setRefresh] = useState(0);

  const load = useCallback(async (userId: string) => {
    try {
      const { data: profile, error: profileError } = await supabase
        .from("profiles").select("role").eq("id", userId).single();
      if (profileError) throw profileError;
      const isSuper = profile?.role === "super_admin";
      const result = isSuper
        ? await supabase.from("clubs").select("id,name").order("name")
        : await supabase.from("club_admins").select("club_id,clubs(id,name)").eq("user_id", userId);
      if (result.error) throw result.error;
      const items: { id: string; name: string }[] = isSuper
        ? ((result.data ?? []) as { id: string; name: string }[])
        : (result.data ?? []).map((r: any) => ({
            id: r.club_id as string,
            name: (Array.isArray(r.clubs) ? r.clubs[0]?.name : r.clubs?.name) ?? r.club_id,
          }));
      setClubs(items);
      setClubId(prev => items.some(c => c.id === prev) ? prev : items[0]?.id ?? "");
      setNotice(items.length ? "Conectado solo a Supabase QA local." : "Cuenta sin clubes asignados.");
    } catch (e) {
      setNotice(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    if (!ALLOWED) return;
    let current = true;
    supabase.auth.getUser().then(({data, error}) => {
      if (current && !error && data.user) setSessionId(data.user.id);
    });
    const {data:{subscription}} = supabase.auth.onAuthStateChange((_event, session) => {
      if (current) setSessionId(session?.user?.id ?? null);
    });
    return () => {current=false; subscription.unsubscribe();};
  }, []);

  useEffect(() => {
    if (ALLOWED && sessionId) void load(sessionId);
    else {setClubs([]);setLeagues([]);}
  }, [load, sessionId]);

  useEffect(() => {
    if (!ALLOWED || !sessionId || !clubId) return;
    let current=true;
    supabase.from("league_clubs")
      .select("is_primary, leagues(*, league_clubs(club_id, is_primary))")
      .eq("club_id", clubId)
      .then(({data,error}) => {
        if(!current) return;
        if(error){setNotice(error.message);return;}
        const entries: QaLeague[] = (data ?? []).flatMap((r: any) => {
          const linked = Array.isArray(r.leagues)
            ? r.leagues : r.leagues ? [r.leagues] : [];
          return linked.map((league: League & {
            league_clubs?: { club_id: string; is_primary: boolean }[];
          }) => ({
            ...league,
            primary_club_id: league.league_clubs?.find((m) => m.is_primary)?.club_id ?? null,
            is_primary_for_club: r.is_primary === true,
          }));
        });
        setLeagues(entries);
      });
    return () => {current=false;};
  }, [sessionId,clubId,refresh]);

  if (!ALLOWED) return <main style={{padding:36}}>
    <h1>STOP: QA local no autorizado</h1>
    <p>Esta página exige Vite en modo desarrollo, navegador localhost,
    VITE_LEAGUE_GUARDED_RPC=true y una URL Supabase en localhost/127.0.0.1.</p>
    <p>No se permite conectar este ensayo a Sharkania de producción.</p>
  </main>;

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotice("");
    const {error}=await supabase.auth.signInWithPassword({email,password});
    setPassword("");
    if(error) setNotice(error.message);
  };
  const logout=async()=>{await supabase.auth.signOut();setSessionId(null);setNotice("Sesión local cerrada.");};
  return <main style={{maxWidth:950, margin:"24px auto",padding:20}}>
    <h1>SHARKANIA — QA SOLO LOCAL · Formulario de ligas</h1>
    <p><strong>Entorno:</strong> {BACKEND} · Nunca utilizar cuentas reales.</p>
    {!sessionId
      ? <form onSubmit={login} style={{display:"grid",maxWidth:420,gap:12}}>
          <label>Correo ficticio<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} /></label>
          <label>Contraseña ficticia<input type="password" required value={password} onChange={e=>setPassword(e.target.value)} /></label>
          <button type="submit">Ingresar a QA local</button>
        </form>
      : <>
          <button type="button" onClick={logout}>Cerrar sesión QA</button>
          <div style={{margin:"20px 0"}}>
            <label>Club de pruebas{" "}
              <select value={clubId} onChange={e=>setClubId(e.target.value)}>
                {clubs.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
          </div>
          <button type="button" disabled={!clubId} onClick={()=>setEdit(null)}>Crear liga QA</button>
          <button type="button" disabled={!clubId} onClick={()=>setRefresh(x=>x+1)}>Actualizar lista</button>
          <h2>Ligas visibles para este club</h2>
          <ul>{leagues.map(l=><li key={l.id}>{l.name}{" "}
            <small>({l.is_primary_for_club ? "organizador" : "participante"})</small>{" "}
            <button type="button" disabled={!l.primary_club_id}
              onClick={()=>setEdit(l)}>Editar en QA</button>
          </li>)}</ul>
          {clubId && edit!==undefined && <LeagueForm
            isOpen onClose={()=>setEdit(undefined)} onSaved={()=>{setEdit(undefined);setRefresh(x=>x+1);}}
            clubId={edit ? (edit.primary_club_id ?? "") : clubId} league={edit} />}
        </>}
    {notice && <p role="status">{notice}</p>}
    <hr style={{margin:"24px 0"}}/>
    <small>Solo desarrollo. No es validación de la pantalla /club-admin completa.
    Verificar después los permisos de participantes y superadmin en el panel real.</small>
  </main>;
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode><QueryClientProvider client={new QueryClient()}><Harness /></QueryClientProvider></React.StrictMode>
);
