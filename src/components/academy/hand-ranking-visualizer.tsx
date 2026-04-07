import { Download, Target } from "lucide-react";
import { Button } from "../ui/button";

const HANDS = [
  { name: "Escalera Real", desc: "A-K-Q-J-10 del mismo palo.", cards: ["A♠", "K♠", "Q♠", "J♠", "10♠"], color: "text-sk-gold", bg: "bg-sk-gold/10", border: "border-sk-gold/30" },
  { name: "Escalera de Color", desc: "5 cartas consecutivas del mismo palo.", cards: ["9♥", "8♥", "7♥", "6♥", "5♥"], color: "text-sk-accent", bg: "bg-sk-accent/10", border: "border-sk-accent/30" },
  { name: "Poker", desc: "4 cartas del mismo valor.", cards: ["K♣", "K♦", "K♥", "K♠", "4♠"], color: "text-sk-green", bg: "bg-sk-green/10", border: "border-sk-green/30" },
  { name: "Full House", desc: "Un trío + un par.", cards: ["8♠", "8♥", "8♦", "A♣", "A♥"], color: "text-sk-text-1", bg: "bg-sk-bg-3", border: "border-sk-border-2" },
  { name: "Color (Flush)", desc: "5 cartas del mismo palo, no consecutivas.", cards: ["A♦", "J♦", "8♦", "5♦", "2♦"], color: "text-sk-text-1", bg: "bg-sk-bg-3", border: "border-sk-border-2" },
  { name: "Escalera", desc: "5 cartas consecutivas de diferentes palos.", cards: ["7♠", "6♦", "5♣", "4♥", "3♠"], color: "text-sk-text-1", bg: "bg-sk-bg-3", border: "border-sk-border-2" },
  { name: "Trío", desc: "3 cartas del mismo valor.", cards: ["Q♥", "Q♣", "Q♦", "9♠", "2♣"], color: "text-sk-text-2", bg: "bg-sk-bg-2", border: "border-sk-border-1" },
  { name: "Doble Par", desc: "Dos pares diferentes.", cards: ["J♠", "J♦", "7♣", "7♥", "K♠"], color: "text-sk-text-2", bg: "bg-sk-bg-2", border: "border-sk-border-1" },
  { name: "Par", desc: "2 cartas del mismo valor.", cards: ["10♣", "10♥", "Q♠", "6♦", "2♣"], color: "text-sk-text-3", bg: "bg-sk-bg-2", border: "border-sk-border-1" },
  { name: "Carta Alta", desc: "Ninguna combinación. Gana la más alta.", cards: ["A♠", "J♣", "8♥", "5♦", "3♠"], color: "text-sk-text-3", bg: "bg-sk-bg-2", border: "border-sk-border-1" },
];

export function HandRankingVisualizer() {
  const pdfUrl = "/recursos/sharkania-ranking-manos.pdf"; 

  return (
    <div className="my-10">
      <div className="bg-sk-bg-2 border border-sk-border-2 rounded-2xl overflow-hidden shadow-sk-lg">
        
        {/* ══ HEADER DEL VISUALIZADOR: Estilo Reporte de Inteligencia ══ */}
        <div className="bg-sk-bg-3 px-6 py-6 border-b border-sk-border-2 flex flex-col sm:flex-row sm:items-center justify-between gap-6 relative overflow-hidden">
          {/* Logo sutil de fondo */}
          <img 
            src="https://nhpjzywfzljtlqaigzed.supabase.co/storage/v1/object/public/Logos%20Sharkania/sharkania-horizontal-light.svg" 
            className="absolute right-4 top-1/2 -translate-y-1/2 h-16 opacity-[0.03] pointer-events-none"
            alt=""
          />

          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-1">
              <div className="p-2 bg-sk-accent/10 rounded-lg border border-sk-accent/20">
                <Target className="text-sk-accent" size={20} />
              </div>
              <h3 className="text-xl md:text-2xl font-black tracking-tight text-sk-text-1">
                Reporte de Inteligencia: Rangos
              </h3>
            </div>
            <p className="text-[10px] text-sk-text-3 font-mono uppercase tracking-[0.2em] mt-2">
              Recurso Oficial · sharkania.com
            </p>
          </div>
          
          <a 
            href={pdfUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className="relative z-10"
            download
          >
            <Button variant="accent" size="md" className="w-full sm:w-auto font-bold shadow-[0_0_20px_rgba(34,211,238,0.15)]">
              <Download size={16} className="mr-2" />
              Descargar PDF Oficial
            </Button>
          </a>
        </div>

        {/* ══ LISTA VISUAL ══ */}
        <div className="p-4 sm:p-6 space-y-3">
          {HANDS.map((hand, i) => (
            <div key={i} className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border ${hand.bg} ${hand.border} transition-all hover:scale-[1.01]`}>
              <div className="flex items-center gap-4">
                <div className={`font-mono text-xl font-black opacity-40 w-6 text-center ${hand.color}`}>
                  {i + 1}
                </div>
                <div>
                  <h4 className={`text-sm md:text-base font-bold ${hand.color}`}>{hand.name}</h4>
                  <p className="text-xs text-sk-text-3 mt-0.5">{hand.desc}</p>
                </div>
              </div>

              {/* Cartas visuales */}
              <div className="flex gap-1.5 pl-10 sm:pl-0">
                {hand.cards.map((card, j) => {
                  const isRed = card.includes('♥') || card.includes('♦');
                  return (
                    <div key={j} className={`w-8 h-11 md:w-10 md:h-14 rounded bg-white flex items-center justify-center font-bold text-sm md:text-base shadow-sm border border-gray-200 ${isRed ? 'text-sk-red' : 'text-slate-900'}`}>
                      {card}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}