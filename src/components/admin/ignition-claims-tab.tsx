// src/components/admin/ignition-claims-tab.tsx
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Copy, CheckCircle, XCircle, Clock, Loader2 } from "lucide-react";

export function IgnitionClaimsTab() {
  const queryClient = useQueryClient();
  const [updating, setUpdating] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Traemos todos los perfiles que tienen un correo de Ignition registrado
  const { data: claims, isLoading } = useQuery({
    queryKey: ["ignition-claims"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, email, whatsapp, ignition_email, ignition_nickname, ignition_status, created_at")
        .not("ignition_email", "is", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const handleUpdateStatus = async (id: string, status: "verified" | "rejected") => {
    setUpdating(id);
    await supabase.from("profiles").update({ ignition_status: status }).eq("id", id);
    await queryClient.invalidateQueries({ queryKey: ["ignition-claims"] });
    await queryClient.invalidateQueries({ queryKey: ["pending-ignition-count"] });
    setUpdating(null);
  };

  const handleCopyPendingEmails = () => {
    if (!claims) return;
    const pendingEmails = claims
      .filter((c) => c.ignition_status === "pending" || !c.ignition_status)
      .map((c) => c.ignition_email)
      .join("\n");
    
    if (pendingEmails) {
      navigator.clipboard.writeText(pendingEmails);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (isLoading) return <div className="p-8 text-center"><Loader2 className="animate-spin mx-auto text-sk-accent" /></div>;

  const pendingCount = claims?.filter(c => c.ignition_status === "pending" || !c.ignition_status).length || 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-sk-bg-2 p-5 rounded-xl border border-sk-border-2">
        <div>
          <h2 className="text-xl font-black text-white">Validaciones Ignition Poker</h2>
          <p className="text-sm text-sk-text-3">Jugadores que solicitaron promo o liga en Ignition.</p>
        </div>
        <Button 
          variant="accent" 
          onClick={handleCopyPendingEmails} 
          disabled={pendingCount === 0}
          className="bg-orange-600 hover:bg-orange-500 text-white"
        >
          {copied ? <CheckCircle size={16} className="mr-2" /> : <Copy size={16} className="mr-2" />}
          {copied ? "¡Copiados!" : `Copiar ${pendingCount} Emails Pendientes`}
        </Button>
      </div>

      <div className="border border-sk-border-2 rounded-lg bg-sk-bg-2 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="bg-sk-bg-3 text-sk-text-2 uppercase text-xs">
              <th className="py-3 px-4">Jugador</th>
              <th className="py-3 px-4">Email Ignition</th>
              <th className="py-3 px-4">Nick Ignition</th>
              <th className="py-3 px-4">WhatsApp</th>
              <th className="py-3 px-4">Estado</th>
              <th className="py-3 px-4 text-right">Acción</th>
            </tr>
          </thead>
          <tbody>
            {claims?.map((claim) => (
              <tr key={claim.id} className="border-t border-sk-border-2 hover:bg-white/[0.02]">
                <td className="py-3 px-4">
                  <div className="font-bold text-white">{claim.display_name}</div>
                  <div className="text-xs text-sk-text-3">{claim.email}</div>
                </td>
                <td className="py-3 px-4 font-mono text-sk-accent">{claim.ignition_email}</td>
                <td className="py-3 px-4 font-mono text-orange-400">{claim.ignition_nickname || "N/A"}</td>
                <td className="py-3 px-4 text-sk-text-2">{claim.whatsapp || "No registrado"}</td>
                <td className="py-3 px-4">
                  {claim.ignition_status === "verified" ? (
                    <Badge variant="green"><CheckCircle size={12} className="mr-1"/> Verificado</Badge>
                  ) : claim.ignition_status === "rejected" ? (
                    <Badge variant="red"><XCircle size={12} className="mr-1"/> Rechazado</Badge>
                  ) : (
                    <Badge variant="orange"><Clock size={12} className="mr-1"/> Pendiente</Badge>
                  )}
                </td>
                <td className="py-3 px-4 text-right">
                  <div className="flex justify-end gap-2">
                    <Button 
                      variant="secondary" size="sm" 
                      onClick={() => handleUpdateStatus(claim.id, "verified")}
                      isLoading={updating === claim.id}
                      disabled={claim.ignition_status === "verified"}
                    >
                      Aprobar
                    </Button>
                    <Button 
                      variant="secondary" size="sm" 
                      onClick={() => handleUpdateStatus(claim.id, "rejected")}
                      isLoading={updating === claim.id}
                      disabled={claim.ignition_status === "rejected"}
                      className="hover:text-red-500"
                    >
                      <XCircle size={16} />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {claims?.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-sk-text-3">No hay registros de Ignition aún.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}