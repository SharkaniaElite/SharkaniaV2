// generate-cards.mjs v3 — ejecutar: node generate-cards.mjs
import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "public", "cards");
mkdirSync(OUT, { recursive: true });

const RANKS = ["A","2","3","4","5","6","7","8","9","T","J","Q","K"];
const SUITS = ["s","h","d","c"];
const DR = { A:"A","2":"2","3":"3","4":"4","5":"5","6":"6","7":"7","8":"8","9":"9",T:"10",J:"J",Q:"Q",K:"K" };
const SC = { s:"#1a1a2e", h:"#cc1f1f", d:"#1a56db", c:"#166534" };
const W=120, H=168, RX=10;

// Simbolos de palo en texto plano (sin HTML entities para SVG)
const SYM = { s:"\u2660", h:"\u2665", d:"\u2666", c:"\u2663" };

function pips(rank) {
  const cx=W/2, t=H*.22, m=H*.50, b=H*.78, l=W*.30, r=W*.70;
  const map = {
    A:  [[cx,m]],
    "2":[[cx,t],[cx,b]],
    "3":[[cx,t],[cx,m],[cx,b]],
    "4":[[l,t],[r,t],[l,b],[r,b]],
    "5":[[l,t],[r,t],[cx,m],[l,b],[r,b]],
    "6":[[l,t],[r,t],[l,m],[r,m],[l,b],[r,b]],
    "7":[[l,t],[r,t],[cx,H*.34],[l,m],[r,m],[l,b],[r,b]],
    "8":[[l,t],[r,t],[cx,H*.32],[l,m],[r,m],[cx,H*.68],[l,b],[r,b]],
    "9":[[l,t],[r,t],[l,H*.37],[r,H*.37],[cx,m],[l,H*.63],[r,H*.63],[l,b],[r,b]],
    T:  [[l,t],[r,t],[cx,H*.28],[l,H*.40],[r,H*.40],[l,H*.60],[r,H*.60],[cx,H*.72],[l,b],[r,b]],
    J:null, Q:null, K:null,
  };
  return map[rank];
}

function faceArt(rank, color) {
  const cx=W/2, cy=H/2;
  if (rank==="J") return [
    `<polygon points="${cx},${cy-28} ${cx+20},${cy} ${cx},${cy+28} ${cx-20},${cy}" fill="none" stroke="${color}" stroke-width="2.5"/>`,
    `<circle cx="${cx}" cy="${cy}" r="4" fill="${color}"/>`,
    `<text x="${cx}" y="${cy+6}" text-anchor="middle" font-size="22" font-family="Georgia,serif" font-weight="700" fill="${color}">J</text>`,
  ].join("");
  if (rank==="Q") {
    const pts=[];
    for(let i=0;i<6;i++){
      const a1=(i*60-90)*Math.PI/180, a2=((i+.5)*60-90)*Math.PI/180;
      pts.push(`${(cx+26*Math.cos(a1)).toFixed(1)},${(cy+26*Math.sin(a1)).toFixed(1)}`);
      pts.push(`${(cx+13*Math.cos(a2)).toFixed(1)},${(cy+13*Math.sin(a2)).toFixed(1)}`);
    }
    return [
      `<polygon points="${pts.join(" ")}" fill="${color}" opacity="0.22" stroke="${color}" stroke-width="1.8"/>`,
      `<circle cx="${cx}" cy="${cy}" r="8" fill="${color}" opacity="0.7"/>`,
      `<text x="${cx}" y="${cy+6}" text-anchor="middle" font-size="20" font-family="Georgia,serif" font-weight="700" fill="${color}">Q</text>`,
    ].join("");
  }
  if (rank==="K") return [
    `<path d="M${cx},${cy-28} L${cx+20},${cy-16} L${cx+20},${cy+8} Q${cx+20},${cy+30} ${cx},${cy+36} Q${cx-20},${cy+30} ${cx-20},${cy+8} L${cx-20},${cy-16} Z" fill="${color}" opacity="0.18" stroke="${color}" stroke-width="2"/>`,
    `<line x1="${cx}" y1="${cy-20}" x2="${cx}" y2="${cy+26}" stroke="${color}" stroke-width="2.5" opacity="0.7"/>`,
    `<line x1="${cx-13}" y1="${cy-2}" x2="${cx+13}" y2="${cy-2}" stroke="${color}" stroke-width="2.5" opacity="0.7"/>`,
    `<circle cx="${cx}" cy="${cy-2}" r="3" fill="${color}" opacity="0.8"/>`,
    `<text x="${cx}" y="${cy+20}" text-anchor="middle" font-size="16" font-family="Georgia,serif" font-weight="700" fill="${color}">K</text>`,
  ].join("");
  return "";
}

function makeCard(rank, suit) {
  const color = SC[suit];
  const sym   = SYM[suit];
  const dr    = DR[rank];
  const isFace = ["J","Q","K"].includes(rank);
  const isAce  = rank === "A";
  const pp     = pips(rank);
  const rfs    = dr === "10" ? 22 : 26;
  const pipSz  = isAce ? 56 : 20;

  let center = "";
  if (isFace) {
    center = faceArt(rank, color);
  } else if (pp) {
    center = pp.map(([px,py]) => {
      const inv = py > H * 0.55;
      return `<text x="${px}" y="${py}" text-anchor="middle" dominant-baseline="central" fill="${color}" font-size="${pipSz}" font-family="system-ui"${inv ? ` transform="rotate(180 ${px} ${py})"` : ""} opacity="0.92">${sym}</text>`;
    }).join("\n");
  }

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">`,
    `<rect x="0.5" y="0.5" width="${W-1}" height="${H-1}" rx="${RX}" fill="#ffffff" stroke="${color}30" stroke-width="1"/>`,
    `<rect x="4" y="4" width="${W-8}" height="${H-8}" rx="${RX-3}" fill="none" stroke="${color}" stroke-width="0.8" opacity="0.20"/>`,
    `<text x="9" y="${rfs+4}" fill="${color}" font-size="${rfs}" font-family="Georgia,serif" font-weight="700" dominant-baseline="hanging">${dr}</text>`,
    `<text x="9" y="${rfs+4+rfs+2}" fill="${color}" font-size="18" font-family="system-ui" dominant-baseline="hanging">${sym}</text>`,
    center,
    `<g transform="rotate(180 ${W/2} ${H/2})">`,
    `<text x="9" y="${rfs+4}" fill="${color}" font-size="${rfs}" font-family="Georgia,serif" font-weight="700" dominant-baseline="hanging">${dr}</text>`,
    `<text x="9" y="${rfs+4+rfs+2}" fill="${color}" font-size="18" font-family="system-ui" dominant-baseline="hanging">${sym}</text>`,
    `</g>`,
    `</svg>`,
  ].join("\n");
}

function makeBack() {
  const tile = 14;
  const c1   = "#22d3ee";
  const c2   = "#0891b2";
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">`,
    `<defs>`,
    `<pattern id="dp" x="0" y="0" width="${tile}" height="${tile}" patternUnits="userSpaceOnUse">`,
    `<rect width="${tile}" height="${tile}" fill="#0c1220"/>`,
    `<rect x="${(tile*.18).toFixed(2)}" y="${(tile*.18).toFixed(2)}" width="${(tile*.64).toFixed(2)}" height="${(tile*.64).toFixed(2)}" transform="rotate(45 ${tile/2} ${tile/2})" fill="none" stroke="${c1}" stroke-width="0.7" opacity="0.30"/>`,
    `</pattern>`,
    `<clipPath id="cc"><rect x="0.5" y="0.5" width="${W-1}" height="${H-1}" rx="${RX}"/></clipPath>`,
    `</defs>`,
    `<rect x="0.5" y="0.5" width="${W-1}" height="${H-1}" rx="${RX}" fill="#0c1220" stroke="${c1}" stroke-width="1.2" opacity="0.70"/>`,
    `<rect x="0" y="0" width="${W}" height="${H}" fill="url(#dp)" clip-path="url(#cc)"/>`,
    `<rect x="6" y="6" width="${W-12}" height="${H-12}" rx="${RX-4}" fill="none" stroke="${c1}" stroke-width="1.2" opacity="0.35"/>`,
    `<rect x="10" y="10" width="${W-20}" height="${H-20}" rx="${RX-6}" fill="none" stroke="${c2}" stroke-width="0.6" opacity="0.25"/>`,
    `<text x="${W/2}" y="${H/2}" text-anchor="middle" dominant-baseline="central" fill="${c1}" font-size="40" font-family="Inter,system-ui" font-weight="700" opacity="0.30">S</text>`,
    `<circle cx="14" cy="14" r="3" fill="${c1}" opacity="0.25"/>`,
    `<circle cx="${W-14}" cy="14" r="3" fill="${c1}" opacity="0.25"/>`,
    `<circle cx="14" cy="${H-14}" r="3" fill="${c1}" opacity="0.25"/>`,
    `<circle cx="${W-14}" cy="${H-14}" r="3" fill="${c1}" opacity="0.25"/>`,
    `</svg>`,
  ].join("\n");
}

// Generar todo
let n = 0;
for (const s of SUITS) {
  for (const r of RANKS) {
    writeFileSync(join(OUT, `${r}${s}.svg`), makeCard(r, s), "utf8");
    n++;
  }
}
writeFileSync(join(OUT, "back.svg"), makeBack(), "utf8");
n++;

console.log(`\n✅ ${n} SVG generados en public/cards/\n`);
console.log("  52 cartas + 1 dorso = 53 archivos\n");
