// Gera os ícones das 30 habilidades (SVG 128×128) em assets/ui/icons/.
// Estilo: moldura arredondada na cor da classe, símbolo claro com contorno escuro e brilho suave,
// coerente com a interface "fantasia cartoon" do handoff de arte.
// Uso: node tools/art/icons.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CLASSES, CLASS_ORDER } from '../../src/classes/classDefinitions.js';

const OUT = fileURLToPath(new URL('../../assets/ui/icons/', import.meta.url));
const INK = '#1c1830';

const CLASS_BG = {
  warrior: ['#8fa6c4', '#4f6788'],
  barbarian: ['#d4884a', '#8a4a22'],
  mage: ['#a47ef0', '#5a36a8'],
  archer: ['#7cc56a', '#2f7a33'],
  mercenary: ['#8a83b0', '#3b3754'],
  halberdier: ['#e6be55', '#9a6f1c'],
};

// Símbolos desenhados num espaço de 128×128. Cores: m = metal, w = madeira, f = fogo, i = gelo, a = arcano, g = ouro.
const C = { m: '#eef3fa', w: '#b8794a', f: '#ffb03b', f2: '#ff5a2a', i: '#bfeeff', a: '#e3d2ff', g: '#ffd65a', r: '#ff6b6b', s: '#d9dde4', k: '#ffffff' };
const sw = `stroke="${INK}" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"`;

const G = {
  sword: (x = 0, y = 0, r = -45) => `<g transform="translate(${64 + x} ${64 + y}) rotate(${r})">
    <path d="M-7 -44 L0 -54 L7 -44 L7 18 L-7 18 Z" fill="${C.m}" ${sw}/>
    <rect x="-20" y="16" width="40" height="10" rx="4" fill="${C.g}" ${sw}/>
    <rect x="-5" y="26" width="10" height="20" rx="3" fill="${C.w}" ${sw}/></g>`,
  dashLines: () => `<g fill="none" stroke-linecap="round"><path d="M18 50 H44 M12 66 H40 M20 82 H46" stroke="${INK}" stroke-width="14"/><path d="M18 50 H44 M12 66 H40 M20 82 H46" stroke="${C.k}" stroke-width="6"/></g>`,
  shield: (fill = C.m) => `<path d="M64 18 L100 30 C100 66 88 92 64 110 C40 92 28 66 28 30 Z" fill="${fill}" ${sw}/>
    <path d="M64 32 L88 40 C88 64 80 82 64 94 Z" fill="#ffffff" opacity="0.35"/>`,
  shout: () => `<path d="M30 52 L58 40 L58 88 L30 76 Z" fill="${C.r}" ${sw}/><rect x="20" y="52" width="14" height="24" rx="4" fill="${C.s}" ${sw}/>
    <g fill="none" stroke="${C.k}" stroke-width="6" stroke-linecap="round"><path d="M74 44 Q86 64 74 84"/><path d="M88 34 Q106 64 88 94"/></g>`,
  cross: () => `<path d="M52 22 H76 V52 H106 V76 H76 V106 H52 V76 H22 V52 H52 Z" fill="${C.g}" ${sw}/>`,
  flame: (s = 1, x = 0, y = 0) => `<g transform="translate(${64 + x} ${64 + y}) scale(${s})"><path d="M0 -46 C18 -24 34 -10 30 14 C27 34 14 44 0 44 C-14 44 -27 34 -30 14 C-33 -6 -16 -14 -12 -34 C-4 -22 -2 -16 0 -46 Z" fill="${C.f2}" ${sw}/>
    <path d="M0 -10 C10 2 16 10 14 22 C12 32 6 36 0 36 C-6 36 -12 32 -14 22 C-15 12 -6 6 0 -10 Z" fill="${C.f}"/></g>`,
  axe: (r = -30) => `<g transform="translate(64 64) rotate(${r})"><rect x="-5" y="-40" width="10" height="88" rx="4" fill="${C.w}" ${sw}/>
    <path d="M4 -42 C30 -48 42 -26 40 -8 C30 -14 16 -14 4 -10 Z" fill="${C.m}" ${sw}/>
    <path d="M-4 -42 C-30 -48 -42 -26 -40 -8 C-30 -14 -16 -14 -4 -10 Z" fill="${C.m}" ${sw}/></g>`,
  whirl: () => `<g fill="none" stroke-linecap="round"><path d="M64 64 m-36 0 a36 36 0 1 1 36 36" stroke="${INK}" stroke-width="16"/><path d="M64 64 m-36 0 a36 36 0 1 1 36 36" stroke="${C.k}" stroke-width="8"/>
    <path d="M64 64 m-18 0 a18 18 0 1 1 18 18" stroke="${INK}" stroke-width="14"/><path d="M64 64 m-18 0 a18 18 0 1 1 18 18" stroke="${C.g}" stroke-width="7"/></g>`,
  burst: (fill = C.g) => `<path d="M64 14 L74 46 L108 38 L84 62 L110 84 L76 82 L70 114 L56 86 L24 100 L40 70 L16 50 L50 48 Z" fill="${fill}" ${sw}/>`,
  skull: () => `<path d="M64 20 C88 20 102 36 102 58 C102 72 94 80 88 84 L88 100 H40 L40 84 C34 80 26 72 26 58 C26 36 40 20 64 20 Z" fill="${C.s}" ${sw}/>
    <circle cx="50" cy="60" r="10" fill="${INK}"/><circle cx="78" cy="60" r="10" fill="${INK}"/><path d="M58 80 L64 72 L70 80 Z" fill="${INK}"/>`,
  orb: (fill = C.a) => `<circle cx="64" cy="64" r="30" fill="${fill}" ${sw}/><circle cx="54" cy="54" r="10" fill="#ffffff" opacity="0.8"/>
    <g stroke="${C.k}" stroke-width="5" stroke-linecap="round"><path d="M64 14 V24 M64 104 V114 M14 64 H24 M104 64 H114"/></g>`,
  bolt: () => `<path d="M72 12 L34 70 H60 L50 116 L94 52 H66 Z" fill="${C.g}" ${sw}/>`,
  snow: () => `<g stroke="${INK}" stroke-width="16" stroke-linecap="round"><path d="M64 18 V110 M24 41 L104 87 M24 87 L104 41"/></g>
    <g stroke="${C.i}" stroke-width="8" stroke-linecap="round"><path d="M64 18 V110 M24 41 L104 87 M24 87 L104 41"/></g>`,
  cloud: (fill = '#cfd3db') => `<path d="M34 92 C16 92 14 68 30 64 C28 46 50 38 60 50 C66 32 96 34 96 56 C112 56 116 82 100 92 Z" fill="${fill}" ${sw}/>`,
  arrow: (r = -45, x = 0, y = 0, s = 1) => `<g transform="translate(${64 + x} ${64 + y}) rotate(${r}) scale(${s})"><rect x="-4" y="-34" width="8" height="70" fill="${C.w}" ${sw}/>
    <path d="M0 -54 L12 -32 H-12 Z" fill="${C.m}" ${sw}/><path d="M-4 30 L-14 46 L-4 42 Z M4 30 L14 46 L4 42 Z" fill="${C.k}" ${sw}/></g>`,
  target: () => `<circle cx="64" cy="64" r="42" fill="${C.k}" ${sw}/><circle cx="64" cy="64" r="28" fill="${C.r}" ${sw}/><circle cx="64" cy="64" r="12" fill="${C.k}" ${sw}/>`,
  rain: () => [-26, 0, 26].map((x) => `<g transform="translate(${64 + x} 60) rotate(180) scale(0.6)"><rect x="-4" y="-34" width="8" height="70" fill="${C.w}" ${sw}/><path d="M0 -54 L12 -32 H-12 Z" fill="${C.m}" ${sw}/></g>`).join(''),
  back: () => `<path d="M96 40 H54 V24 L22 52 L54 80 V64 H96 Z" fill="${C.k}" ${sw}/>`,
  dagger: (r = -45, x = 0, y = 0) => `<g transform="translate(${64 + x} ${64 + y}) rotate(${r}) scale(0.85)"><path d="M-6 -36 L0 -48 L6 -36 L6 12 L-6 12 Z" fill="${C.m}" ${sw}/>
    <rect x="-16" y="10" width="32" height="9" rx="4" fill="#8e7cc3" ${sw}/><rect x="-5" y="19" width="10" height="18" rx="3" fill="#3b3754" ${sw}/></g>`,
  dice: () => `<rect x="30" y="30" width="68" height="68" rx="14" fill="${C.k}" ${sw}/><g fill="${INK}"><circle cx="48" cy="48" r="7"/><circle cx="64" cy="64" r="7"/><circle cx="80" cy="80" r="7"/></g>`,
  spear: (r = 45) => `<g transform="translate(64 64) rotate(${r})"><rect x="-4" y="-30" width="8" height="84" rx="3" fill="${C.w}" ${sw}/><path d="M0 -58 L12 -28 H-12 Z" fill="${C.m}" ${sw}/></g>`,
  arc: () => `<path d="M18 86 Q64 10 110 86" fill="none" stroke="${INK}" stroke-width="18" stroke-linecap="round"/><path d="M18 86 Q64 10 110 86" fill="none" stroke="${C.k}" stroke-width="9" stroke-linecap="round"/>`,
  hook: () => `<path d="M64 14 V70 C64 92 40 96 34 78" fill="none" stroke="${INK}" stroke-width="18" stroke-linecap="round"/><path d="M64 14 V70 C64 92 40 96 34 78" fill="none" stroke="${C.s}" stroke-width="9" stroke-linecap="round"/><path d="M26 70 L34 92 L46 76 Z" fill="${C.s}" ${sw}/>`,
  wall: () => `<rect x="20" y="36" width="88" height="62" rx="6" fill="${C.s}" ${sw}/><g stroke="${INK}" stroke-width="4"><path d="M20 57 H108 M20 77 H108 M50 36 V57 M78 36 V57 M36 57 V77 M64 57 V77 M92 57 V77 M50 77 V98 M78 77 V98"/></g>`,
  star4: () => `<path d="M64 10 L76 52 L118 64 L76 76 L64 118 L52 76 L10 64 L52 52 Z" fill="${C.g}" ${sw}/>`,
  speed: () => `<g fill="none" stroke-linecap="round"><path d="M28 40 L60 64 L28 88" stroke="${INK}" stroke-width="18"/><path d="M28 40 L60 64 L28 88" stroke="${C.k}" stroke-width="9"/><path d="M62 40 L94 64 L62 88" stroke="${INK}" stroke-width="18"/><path d="M62 40 L94 64 L62 88" stroke="${C.g}" stroke-width="9"/></g>`,
};

const ICONS = {
  warrior_power_strike: () => G.sword(0, 0, -45) + G.burst('#ffe27a').replace('<path', '<path transform="translate(54 -10) scale(0.35)"'),
  warrior_charge: () => G.dashLines() + G.shield().replace(/<path/g, '<path transform="translate(22 0) scale(0.8) translate(16 16)"'),
  warrior_defensive_stance: () => G.shield(),
  warrior_taunt: () => G.shout(),
  warrior_last_stand: () => G.shield(C.g) + G.cross().replace('<path', '<path transform="translate(40 38) scale(0.38)"'),
  barb_fury: () => G.flame(1),
  barb_brutal: () => G.axe(-30),
  barb_whirl: () => G.whirl(),
  barb_guard_break: () => G.shield(C.s) + G.burst(C.r).replace('<path', '<path transform="translate(34 34) scale(0.48)"'),
  barb_berserk: () => G.flame(1.05) + G.axe(30).replace('<g transform="translate(64 64) rotate(30)">', '<g transform="translate(64 70) rotate(30) scale(0.55)">'),
  mage_arcane_bolt: () => G.orb(),
  mage_elemental_burst: () => G.burst(C.f2) + G.flame(0.45, 0, 4),
  mage_mystic_ray: () => G.bolt(),
  mage_freezing_field: () => G.snow(),
  mage_arcane_storm: () => G.cloud('#b9a3f0') + `<path d="M62 84 L50 110 H64 L58 124 L80 96 H66 L74 84 Z" fill="${C.g}" ${sw}/>`,
  archer_precise: () => G.target() + G.arrow(-45, 14, -14, 0.8),
  archer_rain: () => G.rain(),
  archer_piercing: () => `<circle cx="44" cy="74" r="16" fill="${C.r}" ${sw}/><circle cx="84" cy="54" r="16" fill="${C.r}" ${sw}/>` + G.arrow(60, 0, 0, 1),
  archer_recoil: () => G.back() + G.arrow(90, 16, 28, 0.6),
  archer_volley: () => G.arrow(-60, -18, 6, 0.75) + G.arrow(-45, 0, 0, 0.75) + G.arrow(-30, 18, -6, 0.75),
  merc_quick_cut: () => G.dagger(-45) + `<path d="M24 98 Q64 70 104 30" fill="none" stroke="${C.k}" stroke-width="5" stroke-linecap="round" opacity="0.9"/>`,
  merc_shadow_step: () => G.speed(),
  merc_opportunist: () => G.dice() + G.dagger(30, 20, 18),
  merc_smoke: () => G.cloud() + G.cloud('#e6e8ec').replace('<path', '<path transform="translate(10 -26) scale(0.8)"'),
  merc_execute: () => G.skull(),
  halb_thrust: () => G.spear(45) + G.dashLines(),
  halb_sweep: () => G.arc() + G.spear(90).replace('<g transform="translate(64 64) rotate(90)">', '<g transform="translate(64 92) rotate(90) scale(0.7)">'),
  halb_hook: () => G.hook(),
  halb_formation: () => G.wall(),
  halb_dominion: () => G.star4() + G.whirl().replace('<g fill="none"', '<g fill="none" transform="translate(32 32) scale(0.5)"'),
};

function iconSvg([c1, c2], glyph) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
<defs><radialGradient id="bg" cx="40%" cy="30%" r="80%"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></radialGradient></defs>
<rect x="4" y="4" width="120" height="120" rx="22" fill="url(#bg)" stroke="${INK}" stroke-width="6"/>
<rect x="12" y="12" width="104" height="40" rx="16" fill="#ffffff" opacity="0.14"/>
<g transform="translate(64 66) scale(0.82) translate(-64 -64)">${glyph()}</g>
</svg>
`;
}

mkdirSync(OUT, { recursive: true });
let n = 0;
for (const classId of CLASS_ORDER) {
  for (const a of CLASSES[classId].abilities) {
    const glyph = ICONS[a.id];
    if (!glyph) throw new Error(`Sem ícone para ${a.id}`);
    writeFileSync(`${OUT}${a.id}.svg`, iconSvg(CLASS_BG[classId], glyph));
    n++;
  }
}
// Ataques básicos (corpo a corpo e à distância), em tons neutros.
writeFileSync(`${OUT}basic_melee.svg`, iconSvg(['#9aa3b5', '#4b5266'], () => G.sword(0, 0, -45)));
writeFileSync(`${OUT}basic_ranged.svg`, iconSvg(['#9aa3b5', '#4b5266'], () => G.arrow(-45, 0, 0, 1)));
console.log(`${n + 2} ícones gerados em assets/ui/icons/`);
