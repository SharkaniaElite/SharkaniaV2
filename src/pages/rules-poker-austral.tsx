import { PageShell } from "../components/layout/page-shell";
import { SEOHead } from "../components/seo/seo-head";
import { Badge } from "../components/ui/badge";
import { Card } from "../components/ui/card";
import { 
  Trophy, Calendar, Users, Shield, 
  DollarSign, Swords, Clock, 
  ChevronRight, Award, AlertTriangle 
} from "lucide-react";
import { RegistrationCTA } from "../components/layout/registration-cta";

export function RulesAustralPage() {
  const dates = [
    { n: 1, day: "DOMINGO", date: "03/05/2026", type: "Regular" },
    { n: 2, day: "MIÉRCOLES", date: "06/05/2026", type: "Regular" },
    { n: 3, day: "DOMINGO", date: "10/05/2026", type: "QUALY HIGH" },
    { n: 4, day: "MIÉRCOLES", date: "13/05/2026", type: "Límite Inscripción" },
    { n: 5, day: "DOMINGO", date: "17/05/2026", type: "6-MAX" },
    { n: 6, day: "MIÉRCOLES", date: "20/05/2026", type: "QUALY HIGH" },
    { n: 7, day: "DOMINGO", date: "24/05/2026", type: "Regular" },
    { n: 8, day: "MIÉRCOLES", date: "27/05/2026", type: "Regular" },
    { n: 9, day: "DOMINGO", date: "31/05/2026", type: "QUALY HIGH" },
    { n: 10, day: "MIÉRCOLES", date: "03/06/2026", type: "6-MAX" },
    { n: 11, day: "DOMINGO", date: "07/06/2026", type: "Regular" },
    { n: 12, day: "MIÉRCOLES", date: "10/06/2026", type: "Regular" },
    { n: 13, day: "DOMINGO", date: "14/06/2026", type: "Regular" },
    { n: "HR", day: "ESPECIAL", date: "POR DEFINIR", type: "HIGH ROLLER" },
    { n: 14, day: "MIÉRCOLES", date: "17/06/2026", type: "Regular" },
    { n: 15, day: "DOMINGO", date: "21/06/2026", type: "6-MAX" },
    { n: 16, day: "MIÉRCOLES", date: "24/06/2026", type: "Regular" },
    { n: "M", day: "DOMINGO", date: "28/06/2026", type: "FECHA MÁSTER" },
  ];

  return (
    <PageShell>
      <SEOHead 
        title="Bases 14° Temporada | Liga Poker Austral" 
        description="Reglamento oficial, premios y estructura de la 14° Temporada de la Liga Poker Austral en Sharkania."
        path="/liga-austral-bases"
      />

      <div className="pt-24 pb-20 px-4 max-w-6xl mx-auto space-y-12">
        
        {/* HERO SECTION */}
        <header className="text-center space-y-4">
          <Badge variant="accent" className="px-4 py-1 text-sk-sm animate-pulse">OFICIAL</Badge>
          <h1 className="text-4xl md:text-6xl font-black text-sk-text-1 tracking-tighter uppercase italic">
            Liga Poker <span className="text-sk-accent">Austral</span>
          </h1>
          <p className="text-sk-md text-sk-text-3 font-mono tracking-widest uppercase">14° Temporada · 2026</p>
        </header>

        <div className="max-w-xl mx-auto w-full">
           <RegistrationCTA />
        </div>

        {/* QUICK STATS GRID */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { icon: Calendar, label: "Fechas", val: "16 + Master" },
            { icon: Clock, label: "Hora Inicio", val: "20:45 (CL)" },
            { icon: DollarSign, label: "Buy-in", val: "$22.000" },
            { icon: Trophy, label: "Premio Final", val: "$1.000.000" },
          ].map((item, i) => (
            <div key={i} className="bg-sk-bg-2 border border-sk-border-2 p-5 rounded-2xl flex flex-col items-center justify-center text-center group hover:border-sk-accent transition-colors">
              <item.icon className="text-sk-accent mb-2 group-hover:scale-110 transition-transform" size={24} />
              <p className="text-[10px] uppercase text-sk-text-4 font-bold">{item.label}</p>
              <p className="text-sk-md font-black text-sk-text-1">{item.val}</p>
            </div>
          ))}
        </div>

        {/* CALENDARIO */}
        <section className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-sk-accent/10 flex items-center justify-center text-sk-accent border border-sk-accent/20">
              <Calendar size={20} />
            </div>
            <h2 className="text-2xl font-black text-sk-text-1 uppercase italic">Cronograma de Batalla</h2>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {dates.map((d, i) => (
              <div key={i} className={`p-4 rounded-xl border flex flex-col justify-between h-32 transition-all ${
                d.type === 'FECHA MÁSTER' 
                ? 'bg-sk-gold/10 border-sk-gold/40' 
                : d.type.includes('HIGH') 
                  ? 'bg-purple-500/10 border-purple-500/40' 
                  : 'bg-sk-bg-3 border-sk-border-2'
              }`}>
                <div>
                  <span className="text-[10px] font-mono text-sk-text-4">FECHA {d.n}</span>
                  <p className="text-sk-sm font-black text-sk-text-1">{d.day} {d.date}</p>
                </div>
                <Badge className="w-fit text-[9px]">{d.type}</Badge>
              </div>
            ))}
          </div>
        </section>

        {/* PREMIOS DESTACADOS */}
        <section className="bg-gradient-to-br from-sk-bg-2 to-sk-bg-0 border-2 border-sk-accent/30 rounded-3xl p-8 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-64 h-64 bg-sk-accent/5 rounded-full blur-3xl -mr-20 -mt-20 group-hover:bg-sk-accent/10 transition-colors" />
          <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
            <div className="w-32 h-32 bg-sk-gold/20 rounded-full flex items-center justify-center border border-sk-gold/30 shadow-[0_0_40px_rgba(250,204,21,0.2)]">
              <Award size={64} className="text-sk-gold" />
            </div>
            <div className="flex-1 text-center md:text-left space-y-4">
              <h2 className="text-3xl font-black text-sk-text-1 uppercase italic">El Botín del Campeón</h2>
              <p className="text-sk-lg text-sk-text-2 leading-tight max-w-2xl">
                El ganador absoluto de la temporada se lleva <strong className="text-sk-gold">$1.000.000</strong> o un paquete VIP: 
                <span className="text-sk-accent"> Entrada OPS Ovalle ($600k) + 4 Noches Keo Hotel + $200k viáticos.</span>
              </p>
              <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                <Badge variant="muted">Ranking: 75% del pozo acumulado</Badge>
                <Badge variant="muted">Master: 25% del pozo acumulado</Badge>
              </div>
            </div>
          </div>
        </section>

        {/* CONTENIDO TÉCNICO EN COLUMNAS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* INSCRIPCIONES Y ESTRUCTURA */}
          <div className="space-y-6">
            <Card className="p-6 space-y-4 border-sk-border-2 bg-sk-bg-2">
              <h3 className="flex items-center gap-2 text-sk-md font-bold text-sk-text-1 uppercase italic">
                <Users size={18} className="text-sk-accent" /> Inscripciones
              </h3>
              <ul className="space-y-3">
                {[
                  "Inscripción Inicial: $40.000 (100% al pozo)",
                  "Plazo máximo pago ranking: 13 de Mayo, 20:00 hrs.",
                  "Liga Abierta: Cualquiera puede jugar la fecha por los premios diarios.",
                  "Eliminación de fechas: Se cuentan tus 13 mejores resultados."
                ].map((t, i) => (
                  <li key={i} className="flex gap-3 text-sk-sm text-sk-text-3">
                    <ChevronRight size={16} className="text-sk-accent shrink-0 mt-0.5" />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </Card>

            <Card className="p-6 space-y-4 border-sk-border-2 bg-sk-bg-2">
              <h3 className="flex items-center gap-2 text-sk-md font-bold text-sk-text-1 uppercase italic">
                <Swords size={18} className="text-sk-accent" /> Estructura de Juego
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-sk-bg-3 p-3 rounded-xl border border-sk-border-2">
                  <p className="text-[10px] text-sk-text-4 uppercase font-bold">Stack Inicial</p>
                  <p className="text-sk-md font-black text-sk-text-1">10.000 Fichas</p>
                </div>
                <div className="bg-sk-bg-3 p-3 rounded-xl border border-sk-border-2">
                  <p className="text-[10px] text-sk-text-4 uppercase font-bold">Ciegas</p>
                  <p className="text-sk-md font-black text-sk-text-1">Cada 10 Min</p>
                </div>
                <div className="bg-sk-bg-3 p-3 rounded-xl border border-sk-border-2">
                  <p className="text-[10px] text-sk-text-4 uppercase font-bold">Rebuys (Máx 2)</p>
                  <p className="text-sk-md font-black text-sk-text-1">$11.000 / 10k</p>
                </div>
                <div className="bg-sk-bg-3 p-3 rounded-xl border border-sk-border-2">
                  <p className="text-[10px] text-sk-text-4 uppercase font-bold">Add-On</p>
                  <p className="text-sk-md font-black text-sk-text-1">$11.000 / 10k</p>
                </div>
              </div>
              <p className="text-[10px] text-center text-sk-text-4 font-mono">Bono Puntualidad: +20 puntos (Registro previo inicio)</p>
            </Card>
          </div>

          {/* PUNTAJES Y ETICA */}
          <div className="space-y-6">
            <Card className="p-6 space-y-4 border-sk-border-2 bg-sk-bg-2">
              <h3 className="flex items-center gap-2 text-sk-md font-bold text-sk-text-1 uppercase italic">
                <Award size={18} className="text-sk-accent" /> Sistema de Puntaje
              </h3>
              <div className="bg-sk-bg-3 p-4 rounded-xl border border-sk-border-3 font-mono text-sk-sm text-sk-accent">
                <p>Base: 100 pts (Último lugar)</p>
                <p>Escalada: +5 pts por posición superior</p>
                <p className="text-sk-text-4 mt-2">Ej: Antepenúltimo = 100+5+5 = 110 pts</p>
              </div>
              
              <div className="pt-2">
                <p className="text-sk-sm font-bold text-sk-text-1 mb-1">Bonificación Mesa Final</p>
                <p className="text-[11px] text-sk-text-3 mb-3">Puntaje adicional: Se multiplica el factor por el número total de participantes del torneo.</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-[11px] font-mono">
                  <div className="flex justify-between items-center bg-sk-bg-3 px-2 py-1.5 rounded border border-sk-border-2"><span className="text-sk-gold font-bold">1° Lugar</span><span>x6.5</span></div>
                  <div className="flex justify-between items-center bg-sk-bg-3 px-2 py-1.5 rounded border border-sk-border-2"><span className="text-sk-text-2 font-bold">2° Lugar</span><span>x5.0</span></div>
                  <div className="flex justify-between items-center bg-sk-bg-3 px-2 py-1.5 rounded border border-sk-border-2"><span className="text-sk-text-3 font-bold">3° Lugar</span><span>x4.0</span></div>
                  <div className="flex justify-between items-center bg-sk-bg-3 px-2 py-1.5 rounded border border-sk-border-2"><span className="text-sk-text-4">4° Lugar</span><span>x3.5</span></div>
                  <div className="flex justify-between items-center bg-sk-bg-3 px-2 py-1.5 rounded border border-sk-border-2"><span className="text-sk-text-4">5° Lugar</span><span>x3.0</span></div>
                  <div className="flex justify-between items-center bg-sk-bg-3 px-2 py-1.5 rounded border border-sk-border-2"><span className="text-sk-text-4">6° Lugar</span><span>x2.5</span></div>
                  <div className="flex justify-between items-center bg-sk-bg-3 px-2 py-1.5 rounded border border-sk-border-2"><span className="text-sk-text-4">7° Lugar</span><span>x2.0</span></div>
                  <div className="flex justify-between items-center bg-sk-bg-3 px-2 py-1.5 rounded border border-sk-border-2"><span className="text-sk-text-4">8° Lugar</span><span>x1.5</span></div>
                  <div className="flex justify-between items-center bg-sk-bg-3 px-2 py-1.5 rounded border border-sk-border-2"><span className="text-sk-text-4">9° Lugar</span><span>x1.2</span></div>
                </div>
              </div>
            </Card>

            <Card className="p-6 space-y-4 border-red-500/20 bg-sk-bg-2">
              <h3 className="flex items-center gap-2 text-sk-md font-bold text-red-400 uppercase italic">
                <Shield size={18} /> Comité de Ética
              </h3>
              <p className="text-sk-sm text-sk-text-3">
                Cero tolerancia a la colusión. Reportes hasta las 12:00 del día siguiente. 
                Las sanciones incluyen pérdida de puntos o expulsión inmediata de la LIGA.
              </p>
              <div className="flex items-center gap-2 p-3 bg-sk-bg-3 rounded-xl border border-sk-border-2 text-[11px] text-sk-text-2">
                <AlertTriangle size={14} className="text-sk-gold shrink-0" />
                <span>Deuda máxima permitida: $60.000 (Sanción: -30 pts ranking)</span>
              </div>
            </Card>
          </div>
        </div>

        {/* CTA FINAL / ACCESO */}
        <section className="text-center p-10 bg-sk-bg-2 border border-sk-border-2 rounded-3xl space-y-6">
          <h2 className="text-2xl font-black text-sk-text-1 uppercase">¿Listo para Dominar el Austral?</h2>
          <div className="flex flex-col md:flex-row gap-6 justify-center">
            <div className="bg-sk-bg-0 p-6 rounded-2xl border border-sk-accent/40 min-w-[250px]">
              <p className="text-sk-xs text-sk-text-4 uppercase font-bold mb-1">ID de Club (PokerStars)</p>
              <p className="text-3xl font-black text-sk-accent tracking-tighter">526900</p>
            </div>
            <div className="bg-sk-bg-0 p-6 rounded-2xl border border-sk-accent/40 min-w-[250px]">
              <p className="text-sk-xs text-sk-text-4 uppercase font-bold mb-1">Código Invitación</p>
              <p className="text-3xl font-black text-sk-text-1 tracking-tighter uppercase">pokeraustral</p>
            </div>
          </div>
          <div className="space-y-4">
            <RegistrationCTA className="max-w-sm mx-auto" />
          </div>
        </section>

      </div>
    </PageShell>
  );
}