// src/pages/admin-broadcast.tsx
import { useState } from "react";
import { supabase } from "../lib/supabase";
import { Button } from "../components/ui/button";
import { Send, Users, AlertCircle, Plus, Trash2, Image as ImageIcon, LayoutTemplate } from "lucide-react";
import { Spinner } from "../components/ui/spinner";
import { PageShell } from "../components/layout/page-shell";

interface NewsBlock {
  id: string;
  title: string;
  imageUrl: string;
  content: string;
}

export function AdminBroadcastPage() {
  const [subject, setSubject] = useState("");
  const [blocks, setBlocks] = useState<NewsBlock[]>([
    { id: "1", title: "", imageUrl: "", content: "" }
  ]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const addBlock = () => {
    setBlocks([...blocks, { id: Date.now().toString(), title: "", imageUrl: "", content: "" }]);
  };

  const removeBlock = (id: string) => {
    setBlocks(blocks.filter(b => b.id !== id));
  };

  const updateBlock = (id: string, field: keyof NewsBlock, value: string) => {
    setBlocks(blocks.map(b => b.id === id ? { ...b, [field]: value } : b));
  };

  // 🔥 Función para armar el HTML del correo (Estilo Sharkania)
  const generateEmailHtml = (nickname: string) => {
    let html = `
      <div style="font-family: sans-serif; max-w: 600px; margin: 0 auto; background-color: #09090b; color: #ffffff; padding: 20px; border-radius: 10px;">
        <div style="text-align: center; border-bottom: 1px solid #333; padding-bottom: 20px; margin-bottom: 20px;">
          <h1 style="color: #a855f7; margin: 0;">Sharkania</h1>
          <p style="color: #999; font-size: 14px; margin-top: 5px;">Boletín Oficial</p>
        </div>
        <p style="font-size: 16px;">Hola <strong>${nickname}</strong>,</p>
        <p style="font-size: 16px; color: #ccc;">Aquí tienes las últimas novedades de nuestra comunidad:</p>
    `;

    blocks.forEach(block => {
      if (block.title || block.content) {
        html += `
          <div style="background-color: #18181b; border: 1px solid #333; border-radius: 8px; margin-top: 25px; overflow: hidden;">
            ${block.imageUrl ? `<img src="${block.imageUrl}" alt="${block.title}" style="width: 100%; height: auto; display: block; border-bottom: 1px solid #333;" />` : ''}
            <div style="padding: 20px;">
              <h2 style="color: #10b981; margin-top: 0; margin-bottom: 10px; font-size: 20px;">${block.title}</h2>
              <p style="color: #e4e4e7; font-size: 15px; line-height: 1.6; margin: 0;">${block.content.replace(/\n/g, '<br/>')}</p>
            </div>
          </div>
        `;
      }
    });

    html += `
        <div style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #333; color: #666; font-size: 12px;">
          <p>Nos vemos en las mesas. ¡Éxito!</p>
          <p>© ${new Date().getFullYear()} Sharkania Platform</p>
        </div>
      </div>
    `;
    return html;
  };

  const handleQueueEmails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject) return alert("Por favor ingresa un asunto.");
    if (blocks.length === 0 || (!blocks[0]?.title && !blocks[0]?.content)) return alert("Agrega al menos una noticia.");
    
    setLoading(true);
    setSuccess(false);

    try {
      const { data: users, error: usersErr } = await supabase
        .from("profiles")
        .select("email")
        .eq("email", "andresduhau@gmail.com");

      if (usersErr) throw usersErr;
      if (!users || users.length === 0) throw new Error("No se encontraron usuarios con correo.");

      const queuePayload = users.map((u) => ({
        recipient_email: u.email, // 🔥 Corrección: ahora coincide exacto con tu tabla
        subject: subject,
        body_html: generateEmailHtml("Jugador"), // 🔥 Usará el saludo genérico por ahora
        status: "pending", 
        created_at: new Date().toISOString(),
      }));

      const { error: insertErr } = await supabase
        .from("email_queue")
        .insert(queuePayload);

      if (insertErr) throw insertErr;

      setSuccess(true);
      setSubject("");
      setBlocks([{ id: Date.now().toString(), title: "", imageUrl: "", content: "" }]);
    } catch (err: any) {
      alert("Error al encolar correos: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageShell>
      <div className="max-w-4xl mx-auto space-y-6 pt-10">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-sk-2xl font-black text-sk-text-1 mb-1">Boletín Sharkania</h2>
            <p className="text-sk-sm text-sk-text-3">Envía noticias y resúmenes a toda la base de datos de usuarios de Sharkania.</p>
          </div>
          <div className="bg-sk-purple/10 text-sk-purple px-4 py-2 rounded-lg border border-sk-purple/20 flex items-center gap-2">
            <LayoutTemplate size={18} />
            <span className="text-sm font-bold">Plantilla Global Activa</span>
          </div>
        </div>

        <form onSubmit={handleQueueEmails} className="space-y-6">
          <div className="bg-sk-bg-2 border border-sk-border-2 rounded-xl p-6 shadow-lg">
            <label className="text-xs uppercase font-mono text-sk-text-3 mb-2 block font-bold">Asunto del Correo</label>
            <input 
              type="text" 
              required
              placeholder="Ej: Resumen Semanal Sharkania: ¡Nuevo Campeón!"
              className="w-full bg-sk-bg-0 border border-sk-border-2 rounded-lg p-3 text-sk-text-1 focus:border-sk-purple outline-none transition-colors text-lg font-bold"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>

          <div className="space-y-4">
            <h3 className="text-sk-md font-bold text-sk-text-2 flex items-center gap-2">
              Contenido del Correo
            </h3>
            
            {blocks.map((block, index) => (
              <div key={block.id} className="bg-sk-bg-2 border border-sk-border-2 rounded-xl p-6 shadow-lg relative group transition-all hover:border-sk-border-3">
                <div className="absolute -left-3 top-6 bg-sk-bg-3 border border-sk-border-2 text-sk-text-3 font-mono text-xs w-6 h-6 flex items-center justify-center rounded-full">
                  {index + 1}
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <label className="text-[10px] uppercase font-mono text-sk-text-3 mb-1 block">Titular</label>
                      <input 
                        type="text" 
                        placeholder="Ej: Nuevas Misiones Disponibles"
                        className="w-full bg-sk-bg-0 border border-sk-border-2 rounded p-2 text-sk-sm text-emerald-400 font-bold focus:border-emerald-500 outline-none"
                        value={block.title}
                        onChange={(e) => updateBlock(block.id, "title", e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase font-mono text-sk-text-3 mb-1 flex items-center gap-1">
                        <ImageIcon size={12}/> Link de la Imagen (Opcional)
                      </label>
                      <input 
                        type="url" 
                        placeholder="https://sharkania.com/imagen.jpg"
                        className="w-full bg-sk-bg-0 border border-sk-border-2 rounded p-2 text-sk-sm text-sk-text-2 focus:border-sk-purple outline-none font-mono text-xs"
                        value={block.imageUrl}
                        onChange={(e) => updateBlock(block.id, "imageUrl", e.target.value)}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] uppercase font-mono text-sk-text-3 mb-1 block">Reseña / Texto</label>
                    <textarea 
                      rows={5}
                      placeholder="Escribe los detalles aquí..."
                      className="w-full bg-sk-bg-0 border border-sk-border-2 rounded p-2 text-sk-sm text-sk-text-1 focus:border-sk-purple outline-none resize-none"
                      value={block.content}
                      onChange={(e) => updateBlock(block.id, "content", e.target.value)}
                    />
                  </div>
                </div>

                {blocks.length > 1 && (
                  <button 
                    type="button" 
                    onClick={() => removeBlock(block.id)}
                    className="absolute top-4 right-4 text-sk-text-4 hover:text-red-400 bg-sk-bg-0 p-1.5 rounded transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="flex justify-center">
            <Button type="button" variant="secondary" onClick={addBlock} className="gap-2 border-dashed border-2 border-sk-border-2 hover:border-sk-purple hover:text-sk-purple bg-transparent">
              <Plus size={16} /> Añadir otra noticia al resumen
            </Button>
          </div>

          <div className="bg-sk-bg-2 border border-sk-border-2 rounded-xl p-6 shadow-lg flex flex-col sm:flex-row justify-between items-center gap-4 mt-8">
            <div className="text-sm text-sk-text-3 flex items-center gap-2">
              <AlertCircle size={16} className="text-amber-500" />
              Se enviará a todos los jugadores registrados de Sharkania.
            </div>
            <Button 
              type="submit" 
              variant="accent" 
              className="gap-2 bg-indigo-600 hover:bg-indigo-500 text-white w-full sm:w-auto px-8"
              disabled={loading}
            >
              {loading ? <Spinner size="sm" /> : <Send size={18} />}
              {loading ? "Encolando..." : "Enviar Boletín"}
            </Button>
          </div>

          {success && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-4 rounded-lg flex items-center gap-3">
              <Users size={20} />
              <p className="text-sm font-bold">¡Boletín encolado exitosamente para la comunidad!</p>
            </div>
          )}
        </form>
      </div>
    </PageShell>
  );
}