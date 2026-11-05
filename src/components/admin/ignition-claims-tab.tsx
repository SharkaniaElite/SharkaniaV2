import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { Button } from "../ui/button";
import { Spinner } from "../ui/spinner";
import { Mail, Filter, RefreshCw, Send, CheckCircle2, Circle, AlertCircle } from "lucide-react";

interface Player {
  id:string; display_name:string|null; email:string|null;
  ignition_nickname:string|null; ignition_email:string|null;
  created_at:string; ignition_linked_at:string|null;
}
type Status = "not_queued"|"pending"|"sent"|"failed"|"ineligible";
type Filter = Status | "all";
type Delivery = { eligible:boolean; queue_status:Status };
const DATE_OPTIONS = [
  {key:"ignition-2026-11-welcome",label:"Bienvenida: cuatro fechas",date:"",num:0},
  {key:"ignition-2026-11-05",label:"Fecha 1 - 5 noviembre",date:"5",num:1},
  {key:"ignition-2026-11-12",label:"Fecha 2 - 12 noviembre",date:"12",num:2},
  {key:"ignition-2026-11-19",label:"Fecha 3 - 19 noviembre",date:"19",num:3},
  {key:"ignition-2026-11-26",label:"Fecha 4 - 26 noviembre",date:"26",num:4},
];
const DATE_STATUSES: Record<Status,string> = {
  not_queued:"Sin preparar",pending:"En cola",sent:"Aceptado por Resend",
  failed:"Fallido",ineligible:"No elegible",
};
function defaultSubject(key:string):string {
  const choice=DATE_OPTIONS.find(item=>item.key===key);
  if(!choice)return "";
  return choice.num===0 ? "Liga SHARKANIA | Información de las cuatro fechas" :
    "Liga SHARKANIA | Información fecha " + choice.num + " (" + choice.date + "/11)";
}
function defaultMessage(key:string):string {
  const choice=DATE_OPTIONS.find(item=>item.key===key);
  if(!choice)return "";
  if(choice.num===0)return [
    "Hola {{nickname}},","","Bienvenido a la Liga SHARKANIA de noviembre.",
    "Jueves 5: [COMPLETAR CLAVE 1]",
    "Jueves 12: [COMPLETAR CLAVE 2]",
    "Jueves 19: [COMPLETAR CLAVE 3]",
    "Jueves 26: [COMPLETAR CLAVE 4]","",
    "Los torneos comienzan a las 21:00, hora de Chile.",
    "Consulta las bases oficiales en sharkania.com.",
    "SHARKANIA",
  ].join("\n");
  return [
    "Hola {{nickname}},",
    "",
    "Hoy jueves " + choice.date + " de noviembre jugamos la fecha " + choice.num + " de la Liga SHARKANIA.",
    "Hora: 21:00, horario de Chile.",
    "Contraseña: [COMPLETAR CLAVE]",
    "",
    "Consulta las bases oficiales y los requisitos de participación.",
    "SHARKANIA",
  ].join("\n");
}
function formatDate(value:string|null,withTime=false):string {
  if(!value)return "—";
  const d=new Date(value);
  if(Number.isNaN(d.getTime()))return "—";
  return new Intl.DateTimeFormat("es-CL",{timeZone:"America/Santiago",day:"2-digit",month:"2-digit",year:"numeric",
    ...(withTime ? {hour:"2-digit",minute:"2-digit"} : {})}).format(d);
}

export function IgnitionClaimsTab(){
  const [campaignKey,setCampaignKey]=useState(DATE_OPTIONS[0].key);
  const [subject,setSubject]=useState(defaultSubject(DATE_OPTIONS[0].key));
  const [content,setContent]=useState(defaultMessage(DATE_OPTIONS[0].key));
  const [players,setPlayers]=useState<Player[]>([]);
  const [delivery,setDelivery]=useState<Map<string,Delivery>>(new Map());
  const [ready,setReady]=useState(false);
  const [loading,setLoading]=useState(true);
  const [sending,setSending]=useState(false);
  const [filter,setFilter]=useState<Filter>("not_queued");
  const [selectedIds,setSelectedIds]=useState<Set<string>>(new Set());
  const [message,setMessage]=useState("");

  async function refresh(key:string){
    setLoading(true);setReady(false);
    try {
      const [p,d]=await Promise.all([
        supabase.from("profiles")
          .select("id,display_name,email,ignition_nickname,ignition_email,created_at,ignition_linked_at")
          .eq("ignition_league_player",true).order("ignition_linked_at",{ascending:false}),
        supabase.rpc("ignition_campaign_recipients",{p_campaign_key:key}),
      ]);
      if(p.error)throw p.error;
      if(d.error)throw d.error;
      const map=new Map<string,Delivery>();
      for(const row of (d.data??[]) as Array<{player_id:string;eligible:boolean;queue_status:Status}>){
        map.set(row.player_id,{eligible:row.eligible,queue_status:row.queue_status});
      }
      setDelivery(map);
      setPlayers((p.data??[]) as Player[]);
      setReady(true);
    } catch(err){
      setDelivery(new Map());setPlayers([]);setReady(false);
      setMessage("❌ No se pudo leer el estado de los envíos. El botón de envío queda inhabilitado: " +
        (err instanceof Error?err.message:"error de conexión"));
    } finally{setLoading(false)}
  }
  useEffect(()=>{void refresh(campaignKey)},[campaignKey]);
  const statusOf=(id:string):Status=>ready?(delivery.get(id)?.queue_status??"ineligible"):"ineligible";
  const selectable=(id:string)=>ready && delivery.get(id)?.eligible===true &&
    (statusOf(id)==="not_queued" || statusOf(id)==="failed");
  const counts=useMemo(()=>{
    const res:Record<Filter,number>={all:players.length,not_queued:0,pending:0,sent:0,failed:0,ineligible:0};
    for(const p of players)res[ready?(delivery.get(p.id)?.queue_status??"ineligible"):"ineligible"]++;
    return res;
  },[players,ready,delivery]);
  const filtered=useMemo(()=>filter==="all"?players:players.filter(p=>statusOf(p.id)===filter),
    [players,filter,delivery,ready]);
  function selectAll(){
    const ids=filtered.filter(p=>selectable(p.id)).map(p=>p.id);
    const already=ids.length>0&&ids.every(id=>selectedIds.has(id));
    setSelectedIds(already?new Set():new Set(ids));
  }
  function toggle(id:string){
    if(!selectable(id))return;
    setSelectedIds(prev=>{
      const next=new Set(prev);
      if(next.has(id))next.delete(id);else next.add(id);
      return next;
    });
  }
  function changeCampaign(key:string){
    if(!DATE_OPTIONS.some(o=>o.key===key))return;
    setCampaignKey(key);setSubject(defaultSubject(key));setContent(defaultMessage(key));
    setFilter("not_queued");setSelectedIds(new Set());setMessage("");
  }
  async function queueSelected(){
    const ids=[...selectedIds];
    if(!ids.length||!ready)return;
    if(ids.some(id=>statusOf(id)!=="not_queued")){
      setMessage("❌ Para preparar selecciona solamente jugadores Sin preparar.");return;
    }
    if(!subject.trim()||!content.trim()){setMessage("❌ Escribe asunto y mensaje.");return;}
    if(/\[(COMPLETAR|CLAVE|CONTRASEÑA)[^\]]*\]/i.test(content)){
      setMessage("❌ Reemplaza las contraseñas de ejemplo antes de preparar la cola.");return;
    }
    const date=DATE_OPTIONS.find(x=>x.key===campaignKey)?.label||campaignKey;
    if(!window.confirm("¿Preparar " + ids.length + " mensajes para " + date +
      "? El Worker enviará los correos posteriormente. Esta acción NO es una prueba."))return;
    setSending(true);setMessage("");
    try {
      const {data,error}=await supabase.rpc("queue_ignition_selected_campaign",{
        p_campaign_key:campaignKey,p_user_ids:ids,p_subject:subject.trim(),p_body_text:content.trim(),
      });
      if(error)throw error;
      const report=data as {queued:number;already_prepared:number;excluded:number}|null;
      setMessage("✅ En cola: " + (report?.queued??0) + ". Ya preparados: " +
        (report?.already_prepared??0) + ". No elegibles: " + (report?.excluded??0) +
        ". La aceptación no equivale a entrega.");
      setSelectedIds(new Set());await refresh(campaignKey);
    } catch(err){
      setMessage("❌ No se pudieron preparar los correos: " +
        (err instanceof Error?err.message:"Error desconocido"));
    } finally{setSending(false)}
  }
  async function retrySelected(){
    const ids=[...selectedIds];
    if(!ids.length||ids.some(id=>statusOf(id)!=="failed")){setMessage("❌ Selecciona solamente correos fallidos.");return;}
    if(!window.confirm("¿Reintentar " + ids.length + " mensajes fallidos de esta fecha?"))return;
    setSending(true);
    try {
      const {data,error}=await supabase.rpc("retry_ignition_failed_campaign",{
        p_campaign_key:campaignKey,p_user_ids:ids,
      });
      if(error)throw error;
      setMessage("✅ " + (data??0) + " mensaje(s) volvieron a la cola.");
      setSelectedIds(new Set());await refresh(campaignKey);
    } catch(err){
      setMessage("❌ No se pudieron reintentar: " +(err instanceof Error?err.message:"Error desconocido"));
    }finally{setSending(false)}
  }
  const onlyFailed=selectedIds.size>0&&[...selectedIds].every(id=>statusOf(id)==="failed");
  if(loading&&players.length===0)return <div className="flex justify-center p-12"><Spinner size="lg"/></div>;
  return <div className="space-y-6">
    <section className="rounded-xl border border-sk-border-2 bg-sk-bg-2 p-6">
      <h3 className="mb-2 flex items-center gap-2 text-sk-lg font-bold text-sk-text-1"><Mail size={20} className="text-sk-accent"/>Correos Ignition · envío manual</h3>
      <p className="mb-5 text-sm text-sk-text-3">Selecciona la fecha, escribe el texto y elige destinatarios. El panel solo prepara la cola cuando lo confirmas; no envía mensajes al abrirse.</p>
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div><label htmlFor="ignition-campaign" className="mb-2 block text-xs font-semibold text-sk-text-2">Fecha o bienvenida</label>
            <select id="ignition-campaign" value={campaignKey} onChange={e=>changeCampaign(e.target.value)}
              className="w-full rounded-md border border-sk-border-2 bg-sk-bg-0 p-3 text-sm text-sk-text-1">
              {DATE_OPTIONS.map(o=><option key={o.key} value={o.key}>{o.label}</option>)}
            </select></div>
          <div><label htmlFor="ignition-subject" className="mb-2 block text-xs font-semibold text-sk-text-2">Asunto</label>
            <input id="ignition-subject" value={subject} maxLength={180} onChange={e=>setSubject(e.target.value)}
              className="w-full rounded-md border border-sk-border-2 bg-sk-bg-0 p-3 text-sm text-sk-text-1"/></div>
          <div><label htmlFor="ignition-content" className="mb-2 block text-xs font-semibold text-sk-text-2">Texto del correo (usa {"{{nickname}}"} para personalizar)</label>
            <textarea id="ignition-content" rows={10} maxLength={7000} value={content} onChange={e=>setContent(e.target.value)}
              className="w-full rounded-md border border-sk-border-2 bg-sk-bg-0 p-3 text-sm text-sk-text-1"/>
            <p className="mt-1 text-xs text-sk-text-3">Reemplaza todas las contraseñas de ejemplo. Los destinatarios usan el correo confirmado de Sharkania.</p>
          </div>
        </div>
        <div className="flex flex-col justify-center gap-4 rounded-lg border border-sk-border-2 bg-sk-bg-3 p-5">
          <p className="text-center text-sm text-sk-text-2">Seleccionados: <strong className="text-sk-text-1">{selectedIds.size}</strong></p>
          <p className="text-xs text-sk-text-3">Solo cuentas confirmadas y vinculaciones verificadas. «En cola» no significa «entregado».</p>
          <Button variant="accent" onClick={onlyFailed?retrySelected:queueSelected}
            disabled={sending||!ready||selectedIds.size===0}>
            {sending?<Spinner size="sm"/>:<Send size={16}/>}
            {onlyFailed?"Reintentar fallidos":"Preparar correos en cola"}
          </Button>
        </div>
      </div>
      {message&&<div role="status" aria-live="polite" className="mt-4 rounded-lg border border-sk-border-2 bg-sk-bg-0 p-3 text-sm text-sk-text-1">{message}</div>}
    </section>
    <div className="rounded-lg border border-sk-border-2 bg-sk-bg-1 p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="flex items-center gap-2 text-xs text-sk-text-3"><Filter size={15}/> Estado de esta fecha</span>
        <Button size="sm" variant="secondary" onClick={()=>{setSelectedIds(new Set());void refresh(campaignKey);}} disabled={loading||sending}><RefreshCw size={14}/>Actualizar estados</Button>
      </div>
      <div className="flex flex-wrap gap-2">
        {(["not_queued","pending","sent","failed","ineligible","all"] as Filter[]).map(value=>
          <Button key={value} size="sm" variant={filter===value?"accent":"secondary"}
            onClick={()=>{setFilter(value);setSelectedIds(new Set());}}>
            {value==="all"?"Todos":DATE_STATUSES[value]} ({counts[value]})
          </Button>)}
      </div>
    </div>
    <div className="overflow-x-auto rounded-xl border border-sk-border-2 bg-sk-bg-2">
      <table className="w-full text-left text-sm">
        <thead className="bg-sk-bg-3 text-[10px] uppercase tracking-wider text-sk-text-3">
          <tr><th className="p-4"><button type="button" onClick={selectAll} disabled={!ready} aria-label="Seleccionar jugadores aptos del filtro"><CheckCircle2 size={20}/></button></th>
            <th className="p-4">Jugador / correo</th><th className="p-4">Ignition</th>
            <th className="p-4">Estado de esta fecha</th><th className="p-4">Cuenta / vinculación</th></tr>
        </thead>
        <tbody>
          {filtered.map(player=>{
            const state=statusOf(player.id),canChoose=selectable(player.id),chosen=selectedIds.has(player.id);
            return <tr key={player.id} onClick={()=>canChoose&&toggle(player.id)}
              className={"border-t border-sk-border-2/60 "+(canChoose?"cursor-pointer hover:bg-sk-bg-3/40":"opacity-75")}>
              <td className="p-4">{canChoose?(chosen?<CheckCircle2 size={20} className="text-sk-accent"/>:<Circle size={20}/>):<AlertCircle size={18}/>}</td>
              <td className="p-4"><strong className="block text-sk-text-1">{player.display_name||player.ignition_nickname||"Jugador"}</strong>
                <span className="text-xs text-sk-text-3">{player.email}</span>
                {player.ignition_email&&player.email&&player.ignition_email.toLowerCase()!==player.email.toLowerCase()&&
                  <span className="block text-[10px] text-amber-400">Email Ignition distinto; se usará el correo confirmado Sharkania.</span>}
              </td>
              <td className="p-4 font-semibold text-orange-400">{player.ignition_nickname||"—"}</td>
              <td className="p-4"><span className={"rounded border px-2 py-1 text-xs "+(state==="sent"?"border-green-500/40 text-green-400":state==="failed"?"border-red-500/40 text-red-400":"border-sk-border-2 text-sk-text-3")}>{DATE_STATUSES[state]}</span></td>
              <td className="p-4 text-xs text-sk-text-3">{formatDate(player.created_at)}<br/>{formatDate(player.ignition_linked_at,true)}</td>
            </tr>;
          })}
          {filtered.length===0&&<tr><td colSpan={5} className="p-10 text-center text-sk-text-3">No hay jugadores en este filtro.</td></tr>}
        </tbody>
      </table>
    </div>
  </div>;
}
