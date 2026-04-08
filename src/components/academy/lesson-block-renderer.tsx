import { useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Target, Lightbulb } from "lucide-react";
import type { LessonBlock } from "../../lib/api/academy";
import { renderWithLinksAndGlossary } from "../../lib/render-inline-links";
import { useGlossaryTerms } from "../../hooks/use-glossary";
import { HandRankingVisualizer } from "./hand-ranking-visualizer"; // 👈 Nueva importación
import type { GlossaryTerm } from "../../lib/api/glossary";
import { WptBanner } from "../blog/wpt-banner";
interface LessonBlockRendererProps {
  blocks: LessonBlock[];
  glossaryTerms?: string[];
}

function GlossaryLink({ term }: { term: string }) {
  return (
    <Link
      to={`/glosario/${term}`}
      className="inline-flex items-center gap-1 text-sk-accent hover:underline underline-offset-2 font-medium"
    >
      {term}
    </Link>
  );
}

function BlockRenderer({ block, glossaryTerms, mascotId, alreadyLinked, h2Index }: { block: LessonBlock, glossaryTerms: GlossaryTerm[], mascotId: number, alreadyLinked: Set<string>, h2Index: number }) {
  const renderContent = (text?: string) => text ? renderWithLinksAndGlossary(text, glossaryTerms, alreadyLinked) : null;

  switch (block.type) {
    case "p":
    case "text":
      return (
        // Volvemos a text-sk-sm para mantener la estética compacta original
        <p className="text-sk-sm text-sk-text-2 leading-relaxed my-3">
          {renderContent(block.content)}
        </p>
      );

    case "h2":
      return (
        <>
          <h2 className="text-sk-lg font-extrabold text-sk-text-1 tracking-tight mt-8 mb-3">
            {renderContent(block.content)}
          </h2>
          {h2Index === 3 && <WptBanner slot="mid" />}
        </>
      );

    case "h3":
      return (
        <h3 className="text-sk-md font-bold text-sk-text-1 mt-6 mb-2">
          {renderContent(block.content)}
        </h3>
      );

    case "callout":
      return (
        <div className="border-l-2 border-sk-accent bg-sk-accent-dim/50 rounded-r-md px-4 py-3 my-4">
          <p className="text-sk-sm text-sk-text-1 font-medium italic leading-relaxed">
            {renderContent(block.content)}
          </p>
        </div>
      );

    case "stat":
      return (
        <div className="bg-sk-bg-3 border border-sk-border-2 rounded-lg px-5 py-4 my-4 flex items-center gap-4">
          <span className="font-mono text-sk-2xl font-extrabold text-sk-accent shrink-0">
            {block.value}
          </span>
          <p className="text-sk-xs text-sk-text-2 leading-relaxed">
            {renderContent(block.content)}
          </p>
        </div>
      );

    case "list":
      return (
        // Volvemos a text-sk-sm en las listas
        <ul className="space-y-2 my-3 ml-1">
          {block.items?.map((item, i) => (
            <li key={i} className="flex gap-2.5 text-sk-sm text-sk-text-2 leading-relaxed">
              <span className="text-sk-accent font-bold shrink-0 mt-0.5">•</span>
              <span>{renderContent(item)}</span>
            </li>
          ))}
        </ul>
      );

    case "tip":
      return (
        <div className="bg-sk-bg-3 border border-sk-accent/20 rounded-xl px-5 py-5 my-6 flex gap-4 overflow-visible relative shadow-sm">
          <div className="absolute top-0 right-0 w-32 h-32 bg-sk-accent/5 blur-3xl rounded-full pointer-events-none" />
          
          <div className="w-14 h-14 shrink-0 relative z-10 -ml-1">
            <div className="absolute inset-0 bg-sk-accent/20 blur-md rounded-full" />
            <img 
              src={`/mascot/shark-${mascotId}.webp`} 
              alt="Sharky Instructor" 
              className="w-full h-full object-contain drop-shadow-[0_5px_8px_rgba(0,0,0,0.6)] relative z-10"
            />
          </div>
          
          <div className="relative z-10 pt-1">
            <p className="text-[10px] font-mono font-bold uppercase tracking-[0.15em] text-sk-accent mb-1.5 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-sk-accent animate-pulse" />
              Sharky Táctico
            </p>
            <p className="text-sk-sm text-sk-text-1 leading-relaxed font-medium">
              {renderContent(block.content?.replace(/^🦈\s*Sharky dice:\s*/i, ""))}
            </p>
          </div>
        </div>
      );

    case "warning":
      return (
        <div className="bg-sk-red-dim/50 border border-sk-red/20 rounded-lg px-4 py-3 my-4 flex gap-3">
          <AlertTriangle size={18} className="text-sk-red shrink-0 mt-0.5" />
          <div>
            <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-sk-red mb-1">
              Atención
            </p>
            <p className="text-sk-xs text-sk-text-2 leading-relaxed">
              {renderContent(block.content)}
            </p>
          </div>
        </div>
      );

    case "action":
      return (
        <div className="bg-sk-gold-dim/50 border border-sk-gold/20 rounded-lg px-4 py-3 my-6 flex gap-3">
          <Target size={18} className="text-sk-gold shrink-0 mt-0.5" />
          <div>
            <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-sk-gold mb-1">
              Misión para tu próximo torneo
            </p>
            <p className="text-sk-xs text-sk-text-1 leading-relaxed font-medium">
              {renderContent(block.content?.replace(/^🎯\s*MISIÓN PARA TU PRÓXIMO TORNEO:\s*/i, ""))}
            </p>
          </div>
        </div>
      );

    case "hand-ranking":
    case "hand_ranking_chart":
      return <HandRankingVisualizer />;

    case "hand":
      return (
        <div className="bg-sk-bg-3 border border-sk-border-2 rounded-lg px-4 py-4 my-6 shadow-sm">
          <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-sk-purple mb-2 flex items-center">
            <Lightbulb size={12} className="mr-1.5" />
            Escenario Táctico
          </p>
          {/* Texto en tamaño original sk-sm */}
          <p className="text-sk-sm text-sk-text-1 font-mono leading-relaxed mb-4">
            {renderContent(block.content)}
          </p>
          {/* Renderizador de Cartas Gráficas */}
          {block.cards && (
            <div className="flex flex-wrap gap-2 mt-4">
              {block.cards.map((card, idx) => {
                const isRed = card.includes('♥') || card.includes('♦');
                return (
                  <div 
                    key={idx} 
                    className={`flex items-center justify-center w-12 h-16 rounded bg-white border-2 ${isRed ? 'border-red-100' : 'border-slate-200'} shadow-sm font-bold text-xl ${isRed ? 'text-red-600' : 'text-slate-900'}`}
                  >
                    {card}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      );

    default:
      return (
        <p className="text-sk-sm text-sk-text-2 leading-relaxed">
          {renderContent(block.content)}
        </p>
      );
  }
}

export function LessonBlockRenderer({ blocks, glossaryTerms }: LessonBlockRendererProps) {
  const [mascotId] = useState(() => Math.floor(Math.random() * 10) + 1);
  const { data: allGlossaryTerms } = useGlossaryTerms();
  const [alreadyLinked] = useState(() => new Set<string>());

  return (
    <div className="space-y-3">
      {blocks.map((block, i) => {
        const h2Index = blocks.slice(0, i + 1).filter((b) => b.type === "h2").length;
        return <BlockRenderer key={i} block={block} glossaryTerms={allGlossaryTerms ?? []} mascotId={mascotId} alreadyLinked={alreadyLinked} h2Index={h2Index} />;
      })}

      {/* Glossary terms footer */}
      {glossaryTerms && glossaryTerms.length > 0 && (
        <div className="mt-8 pt-6 border-t border-sk-border-2">
          <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-sk-text-3 mb-2">
            🦈 Términos del glosario en esta lección
          </p>
          <div className="flex flex-wrap gap-2">
            {glossaryTerms.map((term) => (
              <GlossaryLink key={term} term={term} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}