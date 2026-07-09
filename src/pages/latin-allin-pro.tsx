// src/pages/latin-allin-pro.tsx
import { useState } from "react";
import { Link } from "react-router-dom";
import { PageShell } from "../components/layout/page-shell";
import { SEOHead } from "../components/seo/seo-head";
import { Button } from "../components/ui/button";
import { Lock, Play, Upload, CheckCircle, Shield, Star, Video, Crown } from "lucide-react";
import { useAuthStore } from "../stores/auth-store";
import { supabase } from "../lib/supabase";
import { cn } from "../lib/cn";

export function LatinAllinProPage() {
  const { user, isAuthenticated } = useAuthStore();
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Estados del Formulario
  const [planType, setPlanType] = useState<"pro" | "elite">("pro");
  const [paymentMethod, setPaymentMethod] = useState("transfer");
  const [referralCode, setReferralCode] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setProofFile(e.target.files[0] || null);
    }
  };

  const handleSubmitPayment = async () => {
    if (!user) return alert("Debes iniciar sesión primero.");
    if (!proofFile) return alert("Por favor, adjunta tu comprobante de pago.");

    setUploading(true);
    try {
      // 1. Subir imagen a Supabase Storage
      const fileExt = proofFile.name.split('.').pop();
      const fileName = `${user.id}_${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('comprobantes')
        .upload(`academy/${fileName}`, proofFile);

      if (uploadError) throw uploadError;

      const proofUrl = supabase.storage.from('comprobantes').getPublicUrl(`academy/${fileName}`).data.publicUrl;

      // 2. Crear la suscripción en estado 'pending'
      const { data: subData, error: subError } = await supabase
        .from('pro_subscriptions')
        .insert([{
          user_id: user.id,
          status: 'pending',
          plan_type: planType,
          payment_method: paymentMethod,
          proof_image_url: proofUrl,
        }])
        .select()
        .single();

      if (subError) throw subError;

      // 3. Registrar el referido si existe el código
      if (referralCode.trim()) {
        // Buscamos a quién le pertenece este código
        const { data: referrer } = await supabase
          .from('profiles')
          .select('id')
          .eq('pro_referral_code', referralCode.trim().toUpperCase())
          .maybeSingle();

        if (referrer) {
          // Si el código es válido, le asignamos 10 USD de comisión
          await supabase.from('pro_referrals').insert([{
            referrer_id: referrer.id,
            referred_subscription_id: subData.id,
            status: 'pending',
            commission_amount: 10.00
          }]);
        }
      }

      setSuccess(true);
    } catch (error: any) {
      alert("Error al enviar comprobante: " + error.message);
    } finally {
      setUploading(false);
    }
  };

  const getPrice = () => planType === "pro" ? 50 : 90;

  return (
    <PageShell>
      <SEOHead
        title="Latin Allin PRO | Masterclass de Poker"
        description="Aprende de Nicolás Fuentes. Acceso exclusivo a la bóveda de videos, estrategias postflop y mental game para destruir las mesas."
        path="/masterclass-latinallin"
      />

      <div className="pt-20 pb-20">
        {/* ══ HERO SECTION ══ */}
        <div className="max-w-6xl mx-auto px-6 mb-16">
          <div className="flex flex-col lg:flex-row gap-12 items-center">
            <div className="flex-1 space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sk-gold/10 border border-sk-gold/20 text-sk-gold text-[10px] font-bold uppercase tracking-widest">
                <Star size={12} /> Contenido Premium
              </div>
              <h1 className="text-4xl lg:text-6xl font-black text-sk-text-1 tracking-tight leading-tight">
                Domina las Mesas con <span className="text-transparent bg-clip-text bg-gradient-to-r from-sk-accent to-blue-500">Latin Allin PRO</span>
              </h1>
              <p className="text-sk-lg text-sk-text-2 leading-relaxed">
                El arsenal táctico definitivo diseñado por Nicolás Fuentes. Deja de adivinar y comienza a jugar con la precisión matemática de un profesional.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <Button variant="accent" size="lg" className="px-8 shadow-lg shadow-sk-accent/20" onClick={() => setIsCheckoutOpen(true)}>
                  Inscribirme Ahora
                </Button>
                <Button variant="secondary" size="lg" className="px-8">
                  <Play size={16} className="mr-2" /> Ver Trailer Libre
                </Button>
              </div>

              <div className="flex items-center gap-4 text-sk-sm text-sk-text-3 font-mono">
                <span className="flex items-center gap-1.5"><Shield size={14} className="text-sk-green"/> Pago 100% Seguro</span>
                <span className="flex items-center gap-1.5"><Video size={14} className="text-sk-accent"/> +40 Horas de Video</span>
              </div>
            </div>

            {/* Video Placeholder */}
            <div className="w-full lg:w-[500px] aspect-video bg-sk-bg-3 border border-sk-border-2 rounded-2xl relative overflow-hidden shadow-2xl flex items-center justify-center group cursor-pointer">
              <div className="absolute inset-0 bg-[url('/images/promos/hero-poker.webp')] bg-cover bg-center opacity-40 group-hover:opacity-60 transition-opacity" />
              <div className="w-16 h-16 bg-sk-accent text-black rounded-full flex items-center justify-center z-10 shadow-[0_0_30px_rgba(34,211,238,0.5)] group-hover:scale-110 transition-transform">
                <Play size={24} className="ml-1" />
              </div>
            </div>
          </div>
        </div>

        {/* ══ TEMARIO BLOQUEADO ══ */}
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-2xl font-bold text-sk-text-1 mb-8 text-center">El Camino al Éxito (Temario)</h2>
          
          <div className="space-y-4">
            {[
              { title: "Módulo 1: Fundamentos Preflop Inquebrantables", vids: 5 },
              { title: "Módulo 2: Maestría en Botes 3-Bet", vids: 8 },
              { title: "Módulo 3: Explotando Leaks Postflop", vids: 6 },
              { title: "Módulo 4: Mental Game y Rutina del Grinder", vids: 4 }
            ].map((mod, i) => (
              <div key={i} className="bg-sk-bg-2 border border-sk-border-2 rounded-xl p-5 flex items-center justify-between hover:border-sk-accent/30 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-sk-bg-3 border border-sk-border-2 flex items-center justify-center font-mono font-bold text-sk-text-3">
                    0{i + 1}
                  </div>
                  <div>
                    <h3 className="font-bold text-sk-text-1">{mod.title}</h3>
                    <p className="text-xs text-sk-text-4 font-mono">{mod.vids} videos en HD</p>
                  </div>
                </div>
                <div className="w-8 h-8 rounded-full bg-sk-bg-4 text-sk-text-3 flex items-center justify-center shadow-inner">
                  <Lock size={14} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ══ MODAL DE CHECKOUT MANUAL ══ */}
      {isCheckoutOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-sk-bg-2 border border-sk-border-2 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl relative max-h-[95vh] flex flex-col">
            {success ? (
              <div className="p-10 text-center space-y-4">
                <CheckCircle size={64} className="text-sk-green mx-auto" />
                <h3 className="text-2xl font-bold text-sk-text-1">¡Comprobante Recibido!</h3>
                <p className="text-sk-sm text-sk-text-3">
                  Nicolás revisará tu pago en breve. Una vez aprobado, tendrás acceso total a la academia.
                </p>
                <Button variant="secondary" className="mt-4" onClick={() => { setSuccess(false); setIsCheckoutOpen(false); }}>
                  Entendido
                </Button>
              </div>
            ) : (
              <>
                <div className="px-6 py-5 border-b border-sk-border-2 bg-sk-bg-3 flex justify-between items-center shrink-0">
                  <h3 className="text-lg font-bold text-sk-text-1">Finalizar Inscripción</h3>
                  <button onClick={() => setIsCheckoutOpen(false)} className="text-sk-text-4 hover:text-white">✕</button>
                </div>
                
                <div className="p-6 space-y-5 overflow-y-auto">
                  {!isAuthenticated && (
                    <div className="bg-sk-gold/10 border border-sk-gold/20 rounded-lg p-4 text-center">
                      <p className="text-sk-sm text-sk-gold mb-3">Debes iniciar sesión para vincular tu suscripción.</p>
                      <Link to="/login?redirect=/masterclass-latinallin">
                        <Button variant="secondary" size="sm">Iniciar Sesión / Registrarme</Button>
                      </Link>
                    </div>
                  )}

                  <div className={!isAuthenticated ? "opacity-50 pointer-events-none" : "space-y-6"}>
                    
                    {/* Selección de Plan */}
                    <div className="space-y-3">
                      <label className="text-[10px] font-mono uppercase tracking-widest text-sk-text-3">1. Selecciona tu Plan</label>
                      <div className="grid grid-cols-2 gap-3">
                        <button 
                          onClick={() => setPlanType("pro")}
                          className={cn(
                            "flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all",
                            planType === "pro" ? "border-sk-accent bg-sk-accent/10" : "border-sk-border-2 bg-sk-bg-0 hover:border-sk-border-3"
                          )}
                        >
                          <Star className={planType === "pro" ? "text-sk-accent" : "text-sk-text-3"} size={24} />
                          <span className="font-bold mt-2">Plan PRO</span>
                          <span className="text-xl font-black mt-1">$50<span className="text-xs text-sk-text-4 font-normal">/mes</span></span>
                        </button>
                        <button 
                          onClick={() => setPlanType("elite")}
                          className={cn(
                            "flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all",
                            planType === "elite" ? "border-sk-gold bg-sk-gold/10" : "border-sk-border-2 bg-sk-bg-0 hover:border-sk-border-3"
                          )}
                        >
                          <Crown className={planType === "elite" ? "text-sk-gold" : "text-sk-text-3"} size={24} />
                          <span className="font-bold mt-2">Plan ELITE</span>
                          <span className="text-xl font-black mt-1">$90<span className="text-xs text-sk-text-4 font-normal">/mes</span></span>
                        </button>
                      </div>
                    </div>

                    {/* Método de pago */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-mono uppercase tracking-widest text-sk-text-3">2. Método de Pago</label>
                      <select 
                        value={paymentMethod} 
                        onChange={(e) => setPaymentMethod(e.target.value)}
                        className="w-full bg-sk-bg-0 border border-sk-border-2 rounded-lg p-3 text-sk-sm text-sk-text-1 focus:border-sk-accent focus:outline-none"
                      >
                        <option value="transfer">Transferencia Bancaria (Chile)</option>
                        <option value="crypto">USDT / Criptomonedas</option>
                        <option value="wpt_transfer">Transferencia P2P en Sala</option>
                      </select>
                    </div>

                    {/* Instrucciones según el método */}
                    <div className="bg-sk-bg-0 border border-sk-border-2 rounded-lg p-4 font-mono text-xs text-sk-text-2 space-y-1">
                      <div className="flex justify-between items-center mb-3 pb-2 border-b border-sk-border-2">
                        <span className="text-sk-text-3">Total a transferir:</span>
                        <span className="text-lg font-black text-sk-accent">${getPrice()} USD</span>
                      </div>

                      {paymentMethod === "transfer" && (
                        <>
                          <p className="text-sk-accent font-bold mb-2">Datos Bancarios:</p>
                          <p>Banco: Banco Estado</p>
                          <p>Tipo: Cuenta RUT</p>
                          <p>Monto: ${(getPrice() * 950).toLocaleString('es-CL')} CLP</p>
                        </>
                      )}
                      {paymentMethod === "crypto" && (
                        <>
                          <p className="text-sk-accent font-bold mb-2">Billetera USDT (TRC20):</p>
                          <p className="break-all text-sk-text-4">T9xQwerty1234567890SharkaniaXYZ</p>
                          <p>Monto: {getPrice()}.00 USDT</p>
                        </>
                      )}
                      {paymentMethod === "wpt_transfer" && (
                        <>
                          <p className="text-sk-accent font-bold mb-2">Envío Player-to-Player:</p>
                          <p>Sala: WPT Global o CoinPoker</p>
                          <p>ID Destino: 123456 (Nick: LatinAllin)</p>
                          <p>Monto: ${getPrice()} USD</p>
                        </>
                      )}
                    </div>

                    {/* Subida de Archivo */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-mono uppercase tracking-widest text-sk-text-3">3. Sube tu Comprobante</label>
                      <div className="border-2 border-dashed border-sk-border-2 rounded-lg p-6 text-center hover:border-sk-accent/50 transition-colors relative">
                        <input type="file" accept="image/*" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                        <Upload className="mx-auto mb-2 text-sk-text-4" size={24} />
                        <p className="text-sk-sm font-bold text-sk-text-1">{proofFile ? proofFile.name : "Clic o arrastra tu imagen aquí"}</p>
                      </div>
                    </div>

                    {/* Referido */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-mono uppercase tracking-widest text-sk-text-3">4. Código de Referido (Opcional)</label>
                      <input 
                        type="text" 
                        placeholder="Ej: JUAN-PRO" 
                        value={referralCode}
                        onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                        className="w-full bg-sk-bg-0 border border-sk-border-2 rounded-lg p-3 text-sk-sm text-sk-accent font-bold font-mono focus:border-sk-accent focus:outline-none"
                      />
                      <p className="text-[10px] text-sk-text-4">Si alguien te invitó, ingresa su código aquí.</p>
                    </div>
                  </div>
                </div>

                <div className="p-6 border-t border-sk-border-2 bg-sk-bg-3 flex gap-3 shrink-0">
                  <Button variant="secondary" className="w-full" onClick={() => setIsCheckoutOpen(false)}>Cancelar</Button>
                  <Button variant="accent" className="w-full" onClick={handleSubmitPayment} isLoading={uploading} disabled={!isAuthenticated || !proofFile}>
                    Confirmar Pago
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </PageShell>
  );
}