// src/pages/academy-admin.tsx
import { useState } from "react";
import { PageShell } from "../components/layout/page-shell";
import { SEOHead } from "../components/seo/seo-head";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Check, X as XIcon, ExternalLink, Search, RefreshCw, ShieldAlert, Plus, Pencil, Trash2, FolderOpen, Video as VideoIcon, DollarSign, HandCoins } from "lucide-react";
import { EmptyState } from "../components/ui/empty-state";
import { cn } from "../lib/cn";
import { EntityForm, deleteEntity } from "../components/admin/entity-form";

type Tab = "pending" | "active" | "rejected" | "content" | "affiliates";

export function AcademyAdminPage() {
  const [activeTab, setActiveTab] = useState<Tab>("pending");
  const [searchTerm, setSearchTerm] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Estado para el CMS (Formularios)
  const [entityForm, setEntityForm] = useState<{
    table: string;
    title: string;
    fields: any[];
    data: Record<string, unknown> | null;
  } | null>(null);

  // 1. Suscripciones
  const { data: subscriptions, isLoading, refetch } = useQuery({
    queryKey: ["admin-academy-subscriptions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pro_subscriptions")
        .select(`
          *,
          profiles:user_id (display_name, email, whatsapp, country_code)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as any[];
    },
  });

  const handleAction = async (id: string, action: "active" | "rejected") => {
    if (!confirm(`¿Estás seguro de marcar este pago como ${action === "active" ? "APROBADO" : "RECHAZADO"}?`)) return;
    
    setActionLoading(id);
    try {
      const updateData: any = { status: action, updated_at: new Date().toISOString() };
      
      if (action === "active") {
        const validUntil = new Date();
        validUntil.setFullYear(validUntil.getFullYear() + 1);
        updateData.valid_until = validUntil.toISOString();
      }

      const { error } = await supabase.from("pro_subscriptions").update(updateData).eq("id", id);
      if (error) throw error;
      
      await refetch();
    } catch (err: any) {
      alert("Error al actualizar: " + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  // 2. Módulos y Videos (CMS)
  const { data: modules, refetch: refetchModules } = useQuery({
    queryKey: ["admin-pro-modules"],
    queryFn: async () => {
      const { data } = await supabase.from("pro_academy_modules").select("*").order("sort_order");
      return data ?? [];
    },
  });

  const { data: videos, refetch: refetchVideos } = useQuery({
    queryKey: ["admin-pro-videos"],
    queryFn: async () => {
      const { data } = await supabase.from("pro_academy_videos").select("*, pro_academy_modules(title)").order("sort_order");
      return data ?? [];
    },
  });

  const handleDeleteEntity = async (table: string, id: string, name: string) => {
    if (!confirm(`¿Eliminar "${name}"?`)) return;
    await deleteEntity(table, id);
    if (table === "pro_academy_modules") refetchModules();
    if (table === "pro_academy_videos") refetchVideos();
  };

  const moduleFields = [
    { key: "title", label: "Título del Módulo", type: "text", required: true },
    { key: "description", label: "Descripción corta", type: "textarea" },
    { key: "sort_order", label: "Orden (Ej: 1)", type: "number" },
    { key: "is_active", label: "Activo", type: "checkbox" },
  ];

  const videoFields = [
    { key: "title", label: "Título del Video", type: "text", required: true },
    { key: "module_id", label: "Módulo", type: "select", required: true, options: modules?.map(m => ({ value: m.id, label: m.title })) ?? [] },
    { key: "external_video_url", label: "URL Privada del Video", type: "text", required: true, placeholder: "https://player.vimeo.com/video/..." },
    { key: "duration_minutes", label: "Duración (minutos)", type: "number" },
    { key: "description", label: "Descripción / Notas", type: "textarea" },
    { key: "sort_order", label: "Orden (Ej: 1)", type: "number" },
    { key: "is_active", label: "Activo", type: "checkbox" },
  ];

  // 3. Finanzas / Afiliados
  const { data: referrals, refetch: refetchReferrals } = useQuery({
    queryKey: ["admin-pro-referrals"],
    queryFn: async () => {
      const { data } = await supabase
        .from("pro_referrals")
        .select(`
          id, status, commission_amount, created_at,
          referrer:profiles!pro_referrals_referrer_id_fkey ( display_name, email, pro_referral_code ),
          pro_subscriptions ( plan_type, profiles!pro_subscriptions_user_id_fkey ( display_name, email ) )
        `)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const handlePayReferral = async (id: string) => {
    if (!confirm("¿Marcar esta comisión de $10 como PAGADA y enviada al afiliado?")) return;
    try {
      const { error } = await supabase.from("pro_referrals").update({ status: "paid" }).eq("id", id);
      if (error) throw error;
      refetchReferrals();
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

  // Filtrado de suscripciones
  const filteredData = (subscriptions ?? []).filter((sub) => {
    if (sub.status !== activeTab) return false;
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      const name = (sub.profiles?.display_name || "").toLowerCase();
      const email = (sub.profiles?.email || "").toLowerCase();
      return name.includes(search) || email.includes(search);
    }
    return true;
  });

  const pendingCount = (subscriptions ?? []).filter((s) => s.status === "pending").length;

  return (
    <PageShell>
      <SEOHead title="Administración | Latin Allin PRO" path="/academy-admin" noIndex={true} />
      
      <div className="pt-20 pb-16">
        <div className="max-w-6xl mx-auto px-6">
          
          {/* ══ HEADER ══ */}
          <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sk-accent/10 border border-sk-accent/20 text-sk-accent text-[10px] font-bold uppercase tracking-widest mb-3">
                <ShieldAlert size={12} /> Zona Restringida
              </div>
              <h1 className="text-3xl font-black text-sk-text-1 tracking-tight">
                Academia PRO <span className="text-sk-text-3 font-normal">/ Panel de Control</span>
              </h1>
            </div>
            
            <Button variant="secondary" onClick={() => refetch()} isLoading={isLoading}>
              <RefreshCw size={14} className="mr-2" /> Actualizar Datos
            </Button>
          </div>

          {/* ══ TABS Y BUSCADOR ══ */}
          <div className="bg-sk-bg-2 border border-sk-border-2 rounded-xl p-4 mb-6 flex flex-col md:flex-row justify-between items-center gap-4 overflow-x-auto">
            <div className="flex gap-1 bg-sk-bg-0 border border-sk-border-2 rounded-md p-1 w-full md:w-auto min-w-max">
              {[
                { id: "pending", label: "Comprobantes Pendientes", count: pendingCount },
                { id: "active", label: "Alumnos Activos", count: 0 },
                { id: "rejected", label: "Rechazados", count: 0 },
                { id: "content", label: "Gestión de Contenido", count: 0 },
                { id: "affiliates", label: "Finanzas & Afiliados", count: referrals?.filter(r => r.status === 'pending').length || 0 },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id as Tab)}
                  className={cn(
                    "flex-1 md:flex-none px-4 py-2 rounded-sm text-sk-sm font-medium transition-all relative",
                    activeTab === t.id ? "bg-sk-bg-3 text-sk-text-1 shadow-sm" : "text-sk-text-3 hover:text-sk-text-2"
                  )}
                >
                  {t.label}
                  {(t.id === "pending" || t.id === "affiliates") && t.count > 0 && (
                    <span className="absolute -top-2 -right-2 bg-sk-red text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                      {t.count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {(activeTab === "pending" || activeTab === "active" || activeTab === "rejected") && (
              <div className="relative w-full md:w-72">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-sk-text-4" />
                <input
                  type="text"
                  placeholder="Buscar por email o nombre..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-sk-bg-0 border border-sk-border-2 rounded-md py-2 pl-9 pr-3 text-sk-sm text-sk-text-1 focus:outline-none focus:border-sk-accent"
                />
              </div>
            )}
          </div>

          {/* ══ LISTA DE SUSCRIPCIONES (PENDIENTES, ACTIVOS, RECHAZADOS) ══ */}
          {(activeTab === "pending" || activeTab === "active" || activeTab === "rejected") && (
            isLoading ? (
              <div className="py-20 text-center">
                <div className="w-8 h-8 border-2 border-sk-accent/30 border-t-sk-accent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-sk-text-3 text-sk-sm">Cargando base de datos...</p>
              </div>
            ) : filteredData.length === 0 ? (
              <EmptyState icon="📭" title="Nada por aquí" description={`No hay registros en la pestaña de ${activeTab}.`} />
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {filteredData.map((sub) => (
                  <div key={sub.id} className="bg-sk-bg-2 border border-sk-border-2 rounded-xl p-5 flex flex-col lg:flex-row gap-6 hover:border-sk-accent/30 transition-colors">
                    
                    {/* Comprobante */}
                    <div className="w-full lg:w-48 shrink-0">
                      <p className="text-[10px] font-mono uppercase text-sk-text-3 mb-2">Comprobante adjunto</p>
                      <a href={sub.proof_image_url} target="_blank" rel="noreferrer" className="block relative aspect-square bg-sk-bg-0 border border-sk-border-2 rounded-lg overflow-hidden group">
                        {sub.proof_image_url ? (
                          <img src={sub.proof_image_url} alt="Comprobante" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                        ) : (
                          <div className="flex h-full items-center justify-center text-sk-xs text-sk-text-4">Sin imagen</div>
                        )}
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                          <ExternalLink size={20} className="text-white" />
                        </div>
                      </a>
                    </div>

                    {/* Datos del Usuario */}
                    <div className="flex-1 flex flex-col justify-between">
                      <div>
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h3 className="text-xl font-bold text-sk-text-1 flex items-center gap-2">
                              {sub.profiles?.display_name || "Usuario Sin Nombre"}
                            </h3>
                            <p className="text-sk-sm text-sk-text-3 font-mono mt-1">{sub.profiles?.email}</p>
                          </div>
                          <Badge variant={sub.status === "active" ? "green" : sub.status === "rejected" ? "muted" : "orange"}>
                            {sub.status.toUpperCase()}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 bg-sk-bg-0 border border-sk-border-2 rounded-lg p-4">
                          <div>
                            <p className="text-[10px] uppercase text-sk-text-4 font-mono mb-1">Plan</p>
                            <p className={cn("text-sk-sm font-bold uppercase", sub.plan_type === 'elite' ? 'text-sk-gold' : 'text-sk-accent')}>
                              {sub.plan_type}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase text-sk-text-4 font-mono mb-1">Pago</p>
                            <p className="text-sk-sm font-bold text-sk-text-1 capitalize">{sub.payment_method.replace("_", " ")}</p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase text-sk-text-4 font-mono mb-1">Fecha</p>
                            <p className="text-sk-sm text-sk-text-2">{new Date(sub.created_at).toLocaleDateString()}</p>
                          </div>
                          {sub.profiles?.whatsapp && (
                            <div>
                              <p className="text-[10px] uppercase text-sk-text-4 font-mono mb-1">WhatsApp</p>
                              <a href={`https://wa.me/${sub.profiles.whatsapp.replace(/\D/g,"")}`} target="_blank" rel="noreferrer" className="text-sk-sm font-bold text-sk-green hover:underline">
                                +{sub.profiles.whatsapp}
                              </a>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Acciones */}
                      {sub.status === "pending" && (
                        <div className="flex gap-3 pt-4 mt-4 border-t border-sk-border-2">
                          <Button variant="accent" className="flex-1" onClick={() => handleAction(sub.id, "active")} isLoading={actionLoading === sub.id}>
                            <Check size={14} className="mr-2" /> Aprobar Acceso
                          </Button>
                          <Button variant="danger" className="flex-1" onClick={() => handleAction(sub.id, "rejected")} disabled={actionLoading === sub.id}>
                            <XIcon size={14} className="mr-2" /> Rechazar
                          </Button>
                        </div>
                      )}

                      {sub.status === "active" && sub.valid_until && (
                        <div className="mt-4 pt-4 border-t border-sk-border-2 flex items-center justify-between">
                          <p className="text-sk-xs text-sk-text-3">Válido hasta: <strong className="text-sk-text-1">{new Date(sub.valid_until).toLocaleDateString()}</strong></p>
                          <Button variant="danger" size="sm" onClick={() => handleAction(sub.id, "rejected")} disabled={actionLoading === sub.id}>
                            Revocar Acceso
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          {/* ══ GESTIÓN DE CONTENIDO (CMS) ══ */}
          {activeTab === "content" && (
            <div className="space-y-8 animate-in fade-in">
              {/* MÓDULOS */}
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-sk-md font-bold text-sk-text-1 flex items-center gap-2">
                    <FolderOpen size={18} className="text-sk-accent" /> Módulos ({modules?.length || 0})
                  </h2>
                  <Button variant="accent" size="sm" onClick={() => setEntityForm({ table: "pro_academy_modules", title: "Módulo", fields: moduleFields, data: null })}>
                    <Plus size={14} className="mr-1" /> Nuevo Módulo
                  </Button>
                </div>
                <div className="border border-sk-border-2 rounded-lg bg-sk-bg-2 overflow-x-auto">
                  <table className="w-full text-left text-sk-sm">
                    <thead className="bg-sk-bg-3 font-mono text-[11px] uppercase text-sk-text-3">
                      <tr><th className="p-3">Orden</th><th className="p-3">Título</th><th className="p-3">Estado</th><th className="p-3">Acciones</th></tr>
                    </thead>
                    <tbody className="divide-y divide-sk-border-2">
                      {modules?.map(m => (
                        <tr key={m.id} className="hover:bg-white/[0.02]">
                          <td className="p-3 font-mono text-sk-text-4">{m.sort_order}</td>
                          <td className="p-3 font-bold text-sk-text-1">{m.title}</td>
                          <td className="p-3"><Badge variant={m.is_active ? "green" : "muted"}>{m.is_active ? "Activo" : "Oculto"}</Badge></td>
                          <td className="p-3 flex gap-2">
                            <button onClick={() => setEntityForm({ table: "pro_academy_modules", title: "Módulo", fields: moduleFields, data: m })} className="p-1.5 text-sk-text-3 hover:text-sk-accent"><Pencil size={14}/></button>
                            <button onClick={() => handleDeleteEntity("pro_academy_modules", m.id, m.title)} className="p-1.5 text-sk-text-3 hover:text-sk-red"><Trash2 size={14}/></button>
                          </td>
                        </tr>
                      ))}
                      {(!modules || modules.length === 0) && <tr><td colSpan={4} className="p-4 text-center text-sk-text-4 text-xs">No hay módulos creados.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* VIDEOS */}
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-sk-md font-bold text-sk-text-1 flex items-center gap-2">
                    <VideoIcon size={18} className="text-sk-accent" /> Videos ({videos?.length || 0})
                  </h2>
                  <Button variant="accent" size="sm" onClick={() => setEntityForm({ table: "pro_academy_videos", title: "Video", fields: videoFields, data: null })} disabled={!modules || modules.length === 0}>
                    <Plus size={14} className="mr-1" /> Nuevo Video
                  </Button>
                </div>
                <div className="border border-sk-border-2 rounded-lg bg-sk-bg-2 overflow-x-auto">
                  <table className="w-full text-left text-sk-sm">
                    <thead className="bg-sk-bg-3 font-mono text-[11px] uppercase text-sk-text-3">
                      <tr><th className="p-3">Módulo</th><th className="p-3">Orden</th><th className="p-3">Título</th><th className="p-3">Duración</th><th className="p-3">Acciones</th></tr>
                    </thead>
                    <tbody className="divide-y divide-sk-border-2">
                      {videos?.map(v => (
                        <tr key={v.id} className="hover:bg-white/[0.02]">
                          <td className="p-3 text-sk-text-2 text-xs truncate max-w-[150px]">{v.pro_academy_modules?.title}</td>
                          <td className="p-3 font-mono text-sk-text-4">{v.sort_order}</td>
                          <td className="p-3 font-bold text-sk-text-1">{v.title}</td>
                          <td className="p-3 text-sk-text-3 font-mono">{v.duration_minutes} min</td>
                          <td className="p-3 flex gap-2">
                            <button onClick={() => setEntityForm({ table: "pro_academy_videos", title: "Video", fields: videoFields, data: v })} className="p-1.5 text-sk-text-3 hover:text-sk-accent"><Pencil size={14}/></button>
                            <button onClick={() => handleDeleteEntity("pro_academy_videos", v.id, v.title)} className="p-1.5 text-sk-text-3 hover:text-sk-red"><Trash2 size={14}/></button>
                          </td>
                        </tr>
                      ))}
                      {(!videos || videos.length === 0) && <tr><td colSpan={5} className="p-4 text-center text-sk-text-4 text-xs">No hay videos creados.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ══ FINANZAS Y AFILIADOS ══ */}
          {activeTab === "affiliates" && (
            <div className="space-y-6 animate-in fade-in">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div className="bg-sk-bg-2 border border-sk-border-2 p-5 rounded-xl">
                  <p className="text-[11px] uppercase font-mono text-sk-text-3 mb-1 flex items-center gap-1.5"><DollarSign size={14}/> Comisiones por Pagar</p>
                  <p className="text-3xl font-black text-orange-500">${referrals?.filter(r => r.status === 'pending').reduce((a, b) => a + b.commission_amount, 0) || 0}</p>
                </div>
                <div className="bg-sk-bg-2 border border-sk-border-2 p-5 rounded-xl">
                  <p className="text-[11px] uppercase font-mono text-sk-text-3 mb-1 flex items-center gap-1.5"><HandCoins size={14}/> Comisiones Pagadas</p>
                  <p className="text-3xl font-black text-sk-green">${referrals?.filter(r => r.status === 'paid').reduce((a, b) => a + b.commission_amount, 0) || 0}</p>
                </div>
              </div>

              <div className="border border-sk-border-2 rounded-lg bg-sk-bg-2 overflow-x-auto">
                <table className="w-full text-left text-sk-sm">
                  <thead className="bg-sk-bg-3 font-mono text-[11px] uppercase text-sk-text-3">
                    <tr><th className="p-3">Afiliado (Quien invitó)</th><th className="p-3">Código Usado</th><th className="p-3">Alumno Referido</th><th className="p-3">Comisión</th><th className="p-3">Estado</th><th className="p-3">Acción</th></tr>
                  </thead>
                  <tbody className="divide-y divide-sk-border-2">
                    {referrals?.map(r => (
                      <tr key={r.id} className="hover:bg-white/[0.02]">
                        <td className="p-3">
                          <p className="font-bold text-sk-text-1">{(r.referrer as any)?.display_name}</p>
                          <p className="text-[10px] text-sk-text-4">{(r.referrer as any)?.email}</p>
                        </td>
                        <td className="p-3 font-mono text-sk-accent">{(r.referrer as any)?.pro_referral_code}</td>
                        <td className="p-3">
                          <p className="text-sk-text-2">{(r.pro_subscriptions as any)?.profiles?.display_name}</p>
                          <p className="text-[10px] uppercase font-mono text-sk-gold">Plan {(r.pro_subscriptions as any)?.plan_type}</p>
                        </td>
                        <td className="p-3 font-bold text-sk-green">${r.commission_amount}</td>
                        <td className="p-3"><Badge variant={r.status === 'paid' ? "green" : "orange"}>{r.status === 'paid' ? "Pagado" : "Pendiente"}</Badge></td>
                        <td className="p-3">
                          {r.status === 'pending' && (
                            <Button variant="secondary" size="sm" onClick={() => handlePayReferral(r.id)}>
                              Marcar Pagado
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {(!referrals || referrals.length === 0) && <tr><td colSpan={6} className="p-4 text-center text-sk-text-4 text-xs">No hay referidos registrados aún.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Modal de Formularios CMS */}
      {entityForm && (
        <EntityForm
          isOpen={true}
          onClose={() => setEntityForm(null)}
          onSaved={() => {
            if (entityForm.table === "pro_academy_modules") refetchModules();
            if (entityForm.table === "pro_academy_videos") refetchVideos();
            setEntityForm(null);
          }}
          table={entityForm.table}
          title={entityForm.title}
          fields={entityForm.fields}
          initialData={entityForm.data}
        />
      )}
    </PageShell>
  );
}